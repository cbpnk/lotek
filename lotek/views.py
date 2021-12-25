from urllib.parse import urlencode, quote
from mimetypes import guess_type
from datetime import datetime, timezone
import json
from io import BytesIO
import os
from base64 import b64decode
from email.utils import parseaddr

from wheezy.http import http_error, not_found, method_not_allowed, HTTPResponse
from wheezy.web import authorize, handler_cache
from wheezy.security import Principal
from wheezy.security.crypto.ticket import BASE64_ALTCHARS, EPOCH, unpad, decrypt

from whoosh.highlight import Highlighter, WholeFragmenter, HtmlFormatter

import jsonpatch

from .base import BaseHandler
from .wopi import WOPIBaseHandler
from .files import create_new_file, import_file
from .utils import get_names


def to_nested(data):
    result = {}
    for k, v in data.items():
        path = k.split(".")
        d = result
        for p in path[:-1]:
            d.setdefault(p, {})
            d = d[p]
        d[path[-1]] = v
    return result

def search(index, q, highlight):
    name_highlighter = None
    content_highlighter = None
    if highlight:
        name_highlighter = Highlighter(fragmenter=WholeFragmenter(), formatter=HtmlFormatter(tagname="mark"))
        content_highlighter = Highlighter(formatter=HtmlFormatter(tagname="mark"))
    for hit in index.search(
            q,
            terms=True if highlight else False,
            limit=None):
        d = dict(hit.fields())

        name = d.pop("name_t", None)
        size = d.pop("size_i", None)
        ext = d.pop("ext_s", None)
        d = to_nested(d)

        if size is not None:
            d["size"] = size
        if ext is not None:
            d["ext"] = ext

        if highlight:
            d["excerpts"] = content_highlighter.highlight_hit(hit, "content")
            if name is not None:
                d["name"] = name_highlighter.highlight_hit(hit, "name_t", minscore=0)
        else:
            if name is not None:
                d["name"] = name

        yield d


class SearchHandler(BaseHandler):

    @authorize
    def post(self):
        index = self.options['index']
        form = self.request.form
        q = form.get("q", "")
        highlight = form.get("highlight", "")
        if q:
            return self.json_response([d for d in search(index, q, highlight)])
        return self.json_response([])


def get_token_ttl(ticket, access_token):
    value = b64decode(access_token.encode(), BASE64_ALTCHARS)
    value = value[ticket.digest_size:]
    value = unpad(decrypt(ticket.cypher(), value), ticket.block_size)
    return EPOCH + int.from_bytes(value[4:8], 'little')


class FileHandler(WOPIBaseHandler):

    def format_file(self, info):
        props = info.props
        attrs = props.get("attrs", {})
        attrs['type'] = 'file'
        for key in ('name', 'ext', 'size', 'meta'):
            value = props.get(key, None)
            if value is not None:
                attrs[key] = value

        ext = props.get("ext", None)
        allow = []
        if ext:
            actions = self.wopi_client["formats"].get(ext, {})
            if actions.get("view", actions.get('edit', None)):
                allow.append('view')
            if not info.islink() and actions.get('edit', None):
                allow.append('edit')
            if info.islink():
                allow.append('open')

        response = self.json_response(attrs)
        response.headers.append(("ETag", info.etag()))
        if allow:
            response.headers.append(("X-Lotek-Allow", ",".join(allow)))
        return response

    @authorize
    def get_json(self):
        info = self.record_info
        if not info:
            return not_found()
        if info.props["type"] == 'file':
            return self.format_file(info)
        return self.json_response(info.props)

    @handler_cache()
    def get_wopi(self):
        principal = self.principal
        if not principal:
            return not_found()

        record_id = self.record_id

        info = self.file_info
        if not info:
            return not_found()

        props = info.props
        ext = props["ext"]

        repo = self.options['repo']
        commit = repo.get_latest_commit()
        timestamp = repo.mtime(commit, record_id, ext)

        return self.json_response(
            {'BaseFileName': props.get("name", record_id),
             'OwnerId': '',
             'Size': props["size"],
             'UserId': principal.id,
             'Version': info.object_id.decode(),

             'SupportsDeleteFile': True,
             'SupportsExtendedLockLength': False,
             'SupportsFolders': False,
             'SupportsRename': True,
             'SupportsUpdate': True,
             'SupportsUserInfo': False,

             'IsAnonymousUser': False,
             'UserFriendlyName': principal.alias,
             'UserCanNotWriteRelative': True,
             'UserCanRename': True,
             'UserCanWrite': not info.islink() and ('write' in principal.roles),

             'DisablePrint': True,
             'DisableTranslation': True,
             'FileExtension': f".{ext}",
             'LastModifiedTime': datetime.fromtimestamp(timestamp, timezone.utc).isoformat(),
             'PostMessageOrigin': principal.extra["origin"],
             })

    @authorize
    def post(self):
        request = self.request
        method = request.environ.get("HTTP_X_WOPI_OVERRIDE", "POST")
        if method == 'X-LOTEK-CREATE':
            return self.create()
        elif method == 'X-LOTEK-EMBED':
            return self.embed()
        elif method == 'X-LOTEK-OPEN':
            return self.open()
        print(self.request.environ)

    @authorize
    def patch(self):
        request = self.request

        repo = self.options['repo']

        match = request.environ['HTTP_IF_MATCH']
        patch = json.loads(request.stream.read(request.content_length))

        author = self.author
        date = self.date

        record_id = self.record_id
        message = request.environ.get('HTTP_SUBJECT', f"Update attrs")

        while True:
            commit = repo.get_latest_commit()
            if commit is None:
                return not_found()

            info = repo.get_record_info(commit, record_id)
            if info is None or info.props["type"] != 'file':
                return not_found()
            if info.etag() != match:
                return http_error(412)

            props = info.props
            attrs = props.get("attrs", {})
            if "name" in props:
                attrs["name"] = props["name"]

            attrs = jsonpatch.apply_patch(attrs, patch)
            if "name" in attrs:
                props["name"] = attrs.pop("name")
            props["attrs"] = attrs
            if not attrs:
                del props["attrs"]

            new_commit = repo.put_record(commit, record_id, props, None, message, author, date)
            if new_commit:
                break

        self.update_index()
        return self.format_file(repo.get_record_info(new_commit, record_id))

    def create(self):
        repo = self.options['repo']
        record_id = self.record_id
        request = self.request
        props = json.loads(request.stream.read(request.content_length))

        result = create_new_file(repo, self.options['formats'], record_id, props, self.author, self.date)
        if result is True:
            self.update_index()
            return self.json_response("OK")
        elif result is False:
            return http_error(409)
        else:
            assert False

    def open(self):
        info = self.file_info
        if info is None:
            return not_found()
        if not info.islink():
            return not_found()

        repo = self.options['repo']

        with repo.open(info) as f:
            filename = f.name

        from subprocess import run
        run(
            ["dbus-send",
             "--session",
             "--type=method_call",
             "--dest=org.freedesktop.FileManager1",
             "/org/freedesktop/FileManager1",
             "org.freedesktop.FileManager1.ShowItems",
             "array:string:file://" + os.path.abspath(filename),
             "string:"
             ],
            check=True)
        return self.json_response("OK")

    def embed(self):
        request = self.request
        action = request.query.get('action', ['view'])[0]

        BASE_URL = self.options['BASE_URL']
        record_id = self.record_id
        client = self.wopi_client
        if client is None:
            return not_found()
        ext = self.file_info.props["ext"]
        actions = client["formats"][ext]

        ticket = self.options["ticket"]
        principal = self.principal
        token = Principal(
            id = principal.id,
            roles = ['write' if action == 'edit' else 'read'],
            alias = principal.alias,
            extra = json.dumps({"origin": f'{request.scheme}://{request.host}', "file_id": record_id}))

        base_url = actions.get(action, actions.get('edit', None))

        access_token = ticket.encode(token.dump())
        return self.render_response(
            'wopi.html',
            WOPI_CLIENT_URL = base_url + urlencode({"WOPISrc": f"{BASE_URL}{record_id}"}),
            ACCESS_TOKEN = access_token,
            ACCESS_TOKEN_TTL = str(get_token_ttl(ticket, access_token)*1000),
            PARAMS = client.get("params", []))



class ContentsHandler(WOPIBaseHandler):

    @handler_cache()
    def get_wopi(self):
        principal = self.principal
        if not principal:
            return not_found()

        repo = self.options['repo']
        info = self.file_info
        if not info:
            return not_found()

        record_id = self.record_id
        ext = info.props["ext"]
        name = info.props.get("name", record_id)

        response = HTTPResponse(content_type=guess_type(f"{record_id}.{ext}")[0] or "application/octet-stream")
        response.headers.append(("Content-Disposition", "attachment; filename="+quote(f"{name}.{ext}")))
        response.headers.append(("X-WOPI-ItemVersion", info.object_id.decode()))
        with repo.open(info) as f:
            if hasattr(f, 'name'):
                response.headers.append(("X-Sendfile", os.path.abspath(f.name)))
            else:
                response.write_bytes(f.read())
        return response

    def post(self):
        environ = self.request.environ
        if 'HTTP_X_WOPI_TIMESTAMP' not in environ:
            return method_not_allowed()

        if not self.principal:
            return not_found()

        method = environ.get("HTTP_X_WOPI_OVERRIDE", "POST")
        if method == 'PUT':
            return self.put()
        return method_not_allowed()

    def put(self):
        request = self.request
        environ = request.environ
        if 'HTTP_X_WOPI_TIMESTAMP' not in environ:
            return method_not_allowed()

        data = request.stream.read(request.content_length)

        timestamp = environ.get('HTTP_X_LOOL_WOPI_TIMESTAMP', None)
        if timestamp:
            if timestamp.endswith("Z"):
                timestamp = timestamp[:-1]+"+00:00"
            timestamp = int(datetime.fromisoformat(timestamp).timestamp())

        match = environ.get('HTTP_IF_MATCH', None)

        repo = self.options['repo']
        record_id = self.record_id
        author = self.author
        date = self.date

        while True:
            commit = repo.get_latest_commit()
            info = repo.get_record_info(commit, self.record_id)
            props = info.props
            ext = props["ext"]

            if match and match != info.object_id.decode():
                return http_error(412)

            if timestamp and timestamp != repo.mtime(commit, record_id, ext):
                response = self.json_response({'LOOLStatusCode': 1010})
                response.status_code = 409
                return response

            props["size"] = len(data)
            file_format = getattr(self.options['formats'], ext, None)
            props["meta"] = file_format.extract_metadata(BytesIO(data))

            new_commit = repo.put_record(commit, record_id, props, (ext, 0o100644, data), f"Update {ext} file content", author, date)
            if new_commit:
                new_timestamp = repo.mtime(new_commit, record_id, ext)
                self.update_index()
                return self.json_response(
                    {'LastModifiedTime': datetime.fromtimestamp(new_timestamp, timezone.utc).isoformat()}
                )


class UploadHandler(BaseHandler):

    @authorize
    def post(self):
        options = self.options

        f = self.request.files.get('file', [None])[0]
        record_id, new = import_file(
            options['repo'],
            options['formats'],
            f.filename,
            f.file,
            author=self.author,
            date=self.date)

        if new:
            self.update_index()
        return self.json_response(record_id)


def get_authors(index, AUTH_DOMAIN, change_list):
    for change in change_list:
        name, email = parseaddr(change["author"])
        user_id, domain = email.split("@", 1)
        change["author"] = {"name": name, "id": user_id, "domain": domain, "email": email}

    names = dict(get_names(index, {change["author"]["id"] for change in change_list if change["author"]["domain"] == AUTH_DOMAIN}))
    for change in change_list:
        del change["author"]["domain"]
        name = names.get(change["author"]["id"], None)
        if not name:
            del change["author"]["id"]
            continue
        change["author"]["name"] = name


class ChangesHandler(BaseHandler):

    def post(self):
        options = self.options
        repo = options['repo']
        commit = repo.get_latest_commit()
        change_list = list(repo.changes())
        get_authors(options['index'], options['AUTH_DOMAIN'], change_list)
        return self.json_response(change_list)


all_urls = [
    ("search/", SearchHandler),
    ("changes/", ChangesHandler),
    ("{record_id}/contents", ContentsHandler),
    ("{record_id}", FileHandler),
    ("", UploadHandler),
    ("{path:any}", BaseHandler)
]
