import os
from urllib.request import urlretrieve
from mimetypes import guess_type, add_type
from email.utils import parseaddr
from urllib.parse import quote, urlencode
from shutil import move
import json

import jsonpatch
from wheezy.http import HTTPResponse, CacheProfile, none_cache_profile, not_found, http_error
from wheezy.web import handler_cache, authorize


from .config import config
from .index import spawn_indexer
from .accounts import get_names
from .utils import create_new_txt, import_file
from .auth import BaseHandler

try:
    import uwsgi
except ImportError:
    uwsgi = None

add_type("application/x-maff", ".maff")

vary_accept_profile = CacheProfile('none', no_store=True, http_vary=('Accept',))


def sendfile(response, f):
    if uwsgi:
        response.headers.append(("X-Sendfile", os.path.abspath(f.name)))
    else:
        response.write_bytes(f.read())

def vendor_file(request):
    name = request.environ["route_args"]["name"]
    filename = os.path.join(config.CACHE_ROOT, name)
    try:
        f = open(filename, 'rb')
    except FileNotFoundError:
        local_filename, headers = urlretrieve(f'https://cdn.jsdelivr.net/{quote(name,safe="@/")}')
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        move(local_filename, filename)
        f = open(filename, 'rb')

    response = HTTPResponse(content_type=guess_type(name)[0] or "application/octet-stream")

    with f:
        sendfile(response, f)
    return response


STATIC_ROOT = os.path.join(os.path.dirname(__file__), 'static')

def static_file(request):
    name = request.environ["route_args"]["name"]
    filename = os.path.join(config.STATIC_ROOT, name)
    try:
        f = open(filename, 'rb')
    except FileNotFoundError:
        filename = os.path.join(STATIC_ROOT, name)
        try:
            f = open(filename, 'rb')
        except FileNotFoundError:
            return not_found()

    response = HTTPResponse(content_type=guess_type(name)[0])
    with f:
        sendfile(response, f)
    return response


def _search(q, highlight):
    highlighter = None
    if highlight:
        from whoosh.highlight import Highlighter, HtmlFormatter
        highlighter = Highlighter(formatter=HtmlFormatter(tagname="mark"))

    for hit in config.index.search(
            q,
            terms=True if highlight else False,
            limit=None,
            highlighter=highlighter):
        d = dict(hit.fields())
        if highlight:
            d["excerpts"] = hit.highlights("content")
        yield d


class SearchHandler(BaseHandler):

    def post(self):
        commit = config.repo.get_latest_commit()
        q = self.request.form.get("q", "")
        highlight = self.request.form.get("highlight", "")
        if q:
            return self.json_response([d for d in _search(q, highlight)])
        return self.json_response([])


class BaseTextHandler(BaseHandler):

    @handler_cache(vary_accept_profile)
    def get(self):
        return self.get_file(config.repo.get_latest_commit(), self.get_filename())

    def get_file(self, commit, filename):
        obj = config.repo.get_object(commit, filename)
        if obj is None:
            return not_found()
        content = config.repo.get_data(obj)

        accept_header = self.request.environ.get('HTTP_ACCEPT', 'text/html')
        for mime_type in accept_header.split(","):
            mime_type = mime_type.strip().split(";", 1)[0]
            if mime_type == 'application/json':
                metadata, html = config.parser.convert(content.decode())
                title = metadata.get("title_t", ["Untitled"])[0]
                metadata["html"] = self.render_template(
                    'txt.html',
                    title=title,
                    html=html,
                    CSRF_TOKEN=json.dumps(self.xsrf_token if self.principal is not None else None))
                response = self.json_response(metadata)
                response.headers.append(("ETag", obj.decode()))
                return response
            elif mime_type == 'text/html':
                return super().get()
            elif mime_type in ('text/plain', '*/*'):
                response = HTTPResponse(content_type='text/plain; charset=utf-8')
                response.headers.append(("ETag", obj.decode()))
                response.write_bytes(content)
                return response
        return http_error(406)

    @authorize
    def put(self):
        filename = self.get_filename()
        body = self.request.stream.read(self.request.content_length)
        meta = json.loads(body) if body else {}

        if not create_new_txt(filename, meta, author=self.author, author_time=self.date):
            return http_error(409)

        spawn_indexer()
        return self.json_response("OK")

    @authorize
    def post(self):
        filename = self.get_filename()
        repo = config.repo
        parser = config.parser

        while True:
            commit = repo.get_latest_commit()
            if commit is None:
                return not_found()
            obj = repo.get_object(commit, filename)
            if obj is None:
                return not_found()

            metadata = parser.parse(repo.get_data(obj).decode())
            new_content = config.editor.get_new_content(filename, metadata)
            if not new_content:
                break
            commit = repo.replace_content(commit, filename, parser.format(new_content), f'Update: {filename}', self.author, self.date)
            if commit:
                spawn_indexer()
                break

        return self.get_file(commit, filename)

    @authorize
    def patch(self):
        filename = self.get_filename()
        repo = config.repo
        parser = config.parser

        match = self.request.environ['HTTP_IF_MATCH']
        patch = json.loads(self.request.stream.read(self.request.content_length))

        while True:
            commit = repo.get_latest_commit()
            if commit is None:
                return not_found()
            obj = repo.get_object(commit, filename)
            if obj is None:
                return not_found()
            if obj.decode() != match:
                return http_error(412)

            metadata = parser.parse(repo.get_data(obj).decode())
            metadata = jsonpatch.apply_patch(metadata, patch)
            empty_keys = [key for key in metadata if not metadata[key]]
            for key in empty_keys:
                del metadata[key]

            new_commit = repo.replace_content(commit, filename, parser.format(metadata), f'Update: {filename}', self.author, self.date)
            if new_commit:
                spawn_indexer()
                break

        return self.get_file(new_commit, filename)


class TextHandler(BaseTextHandler):

    def get_filename(self):
        path = self.route_args['path']

        if os.path.basename(path).startswith("."):
            return
        return path + ".txt"

class UserHandler(BaseTextHandler):

    def get_filename(self):
        username = self.route_args['username']
        return '~' + username


class MediaFileHandler(BaseHandler):

    def open(self):
        filename = self.route_args['filename']
        from subprocess import run
        run(
            ["dbus-send",
             "--session",
             "--type=method_call",
             "--dest=org.freedesktop.FileManager1",
             "/org/freedesktop/FileManager1",
             "org.freedesktop.FileManager1.ShowItems",
             "array:string:file://" + os.path.abspath(config.repo.file_path(filename)),
             "string:"
             ],
            check=True)
        return self.json_response("OK")

    @handler_cache(vary_accept_profile)
    def get(self):
        filename = self.route_args['filename']

        repo = config.repo

        commit = repo.get_latest_commit()
        basename, ext = os.path.splitext(filename)
        ext = ext[1:]
        obj = repo.get_object(commit, basename+".txt")
        if obj is None:
            return not_found()
        content = repo.get_data(obj)
        metadata = config.parser.parse(content.decode())
        title = metadata.get("title_t", [None])[0]

        content_type = guess_type(filename)[0] or "application/octet-stream"

        try:
            f = repo.open_file(filename)
        except FileNotFoundError:
            return not_found()

        with f:
            accept_header = self.request.environ.get('HTTP_ACCEPT', 'text/html')
            for mime_type in accept_header.split(","):
                mime_type = mime_type.strip().split(";", 1)[0]
                if mime_type == 'text/html':
                    if self.request.environ.get("HTTP_REFERER", None) != f'{self.request.environ["wsgi.url_scheme"]}://{self.request.environ["HTTP_HOST"]}{self.request.environ["PATH_INFO"]}':
                        return super().get()
                    mod = config.media_formats.get(f".{ext}", None)
                    context = {"title": title +"." + ext if title else filename}
                    if mod and hasattr(mod, 'render_context'):
                        context.update(mod.render_context(filename, f))
                    return self.render_response(f'{ext}.html', **context)
                elif mime_type in (content_type, '*/*'):
                    response = HTTPResponse(content_type=content_type)
                    if title:
                        response.headers.append(("Content-Disposition", "attachment; filename="+quote(title + "." + ext)))
                    sendfile(response, f)
                    return response

            return http_error(406)


class MaffHandler(BaseHandler):

    @handler_cache(none_cache_profile)
    def get(self):
        from zipfile import ZipFile

        basename = self.route_args['basename']
        path = self.route_args['path']

        try:
            maff = ZipFile(config.repo.file_path(basename + ".maff"))
        except FileNotFoundError:
            return not_found()

        with maff:
            try:
                f = maff.open(path)
            except KeyError:
                return not_found()

            with f:
                response = HTTPResponse(content_type=guess_type(path)[0] or "application/octet-stream")
                response.headers.append(('Content-Security-Policy', "connect-src 'none'; form-action 'none';"))
                response.write_bytes(f.read())
                return response


class UploadHandler(BaseHandler):

    @authorize
    def post(self):
        f = self.request.files.get('file', [None])[0]
        filename = import_file(f.filename, f.file, author=self.author, author_time=self.date)
        spawn_indexer()
        return self.json_response(filename)


def get_link(repo, commit, path):
    if os.path.basename(path).startswith("."):
        return
    if path.endswith(".h.json"):
        obj = repo.get_object(commit, path)
        if obj is None:
            return
        data = repo.get_data(obj)
        payload = json.loads(data)
        return payload["uri"][1:].split("!", 1)[0] + "#annotations:" + path[:-7]
    else:
        return path

def get_authors(change_list):
    for change in change_list:
        name, email = parseaddr(change["author"])
        change["author"] = {"name": name, "email": email}

    names = dict(get_names(set(change["author"]["email"].split("@", 1)[0] for change in change_list)))
    for change in change_list:
        d = names.get(change["author"]["email"].split("@", 1)[0], None)
        if not d:
            continue

        change["author"].update(d)

def get_titles(change_list):
    from whoosh.query import Or, Term
    terms = [
        Term("path", path)
        for path in set(
                os.path.splitext(c["link"].split("#", 1)[0])[0] + ".txt"
                for change in change_list
                for c in change["changes"]
                if c["link"])]
    q = Or(terms)

    if terms:
        d = {hit["path"]: hit.get("title_t", [None])[0]
             for hit in config.index.search(q, limit=len(terms))
             if "title_t" in hit}
    else:
        d = {}

    for change in change_list:
        for c in change["changes"]:
            if not c["link"]:
                continue
            base, ext = os.path.splitext(c["link"].split("#", 1)[0])
            title = d.get(base+".txt", None)
            if title:
                if ext != '.txt':
                    title = title + ext
                c["title"] = title

class ChangesHandler(BaseHandler):

    def post(self):
        repo = config.repo
        commit = repo.get_latest_commit()
        change_list = list(repo.changes())
        for change in change_list:
            for c in change["changes"]:
                c["link"] = get_link(repo, commit, c["path"])

        get_titles(change_list)
        get_authors(change_list)

        return self.json_response(change_list)





