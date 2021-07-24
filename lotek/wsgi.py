import os
from wheezy.routing import PathRouter
from wheezy.http import WSGIApplication, bootstrap_http_defaults, HTTPResponse, not_found, unauthorized, method_not_allowed, json_response, http_error
from wheezy.template.engine import Engine
from wheezy.template.ext.core import CoreExtension
from wheezy.template.ext.code import CodeExtension
from wheezy.template.loader import FileLoader, autoreload
from html import escape
from mimetypes import guess_type
from email.utils import parsedate_to_datetime, formataddr
import jsonpatch
import json
from urllib.request import urlretrieve
from urllib.parse import quote
from contextlib import nullcontext
from shutil import move
from warnings import catch_warnings
from .config import config
from .hypothesis import hypothesis_urls
from .index import spawn_indexer
from .accounts import check_passwd, replace_passwd, get_name
from .utils import create_new_txt, import_file

try:
    import uwsgi
except ImportError:
    uwsgi = None

engine = Engine(
    loader=FileLoader([os.path.join(os.path.dirname(__file__), 'templates')]),
    extensions=[CoreExtension(), CodeExtension()])

with catch_warnings(record=True):
    engine = autoreload(engine)

engine.global_vars.update({'e': escape})

STATIC_ROOT = os.path.join(os.path.dirname(__file__), 'static')

def sendfile(response, f, filename):
    if uwsgi:
        response.headers.append(("X-Sendfile", os.path.abspath(filename)))
    else:
        response.write_bytes(f.read())

def vendor_file(request, name):
    filename = os.path.join(config.STATIC_ROOT, name)
    try:
        f = open(filename, 'rb')
    except FileNotFoundError:
        local_filename, headers = urlretrieve(f'https://cdn.jsdelivr.net/{quote(name,safe="@/")}')
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        move(local_filename, filename)
        f = open(filename, 'rb')

    response = HTTPResponse(content_type=guess_type(name)[0] or "application/octet-stream")

    with f:
        sendfile(response, f, filename)
    return response

def static_file(request, name):
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
        sendfile(response, f, filename)
    return response

def _search(repo, commit, q, highlight):
    highlighter = None
    if highlight:
        from whoosh.highlight import Highlighter, HtmlFormatter
        highlighter = Highlighter(formatter=HtmlFormatter(tagname="mark"))

    for hit in config.index.search(
            q,
            terms=True if highlight else False,
            highlighter=highlighter):
        d = dict(hit.fields())
        obj = repo.get_object(commit, d["path"])
        metadata = config.parser.parse(repo.get_data(obj).decode())
        if highlight:
            d["excerpts"] = hit.highlights("content", text=metadata["content"])
        yield d


def search(request):
    if request.method == 'GET':
        return default_page()
    elif request.method == 'POST':
        commit = config.repo.get_latest_commit()
        q = request.form.get("q", "")
        highlight = request.form.get("highlight", "")
        if q:
            return json_response([d for d in _search(config.repo, commit, q, highlight)])
        return json_response([])

def get_repo_file(request, commit, filename):
    obj = config.repo.get_object(commit, filename)
    if obj is None:
        return not_found()
    content = config.repo.get_data(obj)

    ext = os.path.splitext(filename)[1][1:]
    content_type = guess_type(filename)[0] or "application/octet-stream"

    if ext != 'txt':
        fullname = os.path.join(config._config.REPO_ROOT, 'media', filename)
        try:
            f = open(fullname, 'rb')
        except FileNotFoundError:
            return not_found()
    else:
        f = nullcontext()

    with f:
        accept_header = request.environ.get('HTTP_ACCEPT', 'text/html')
        for mime_type in accept_header.split(","):
            mime_type = mime_type.strip().split(";", 1)[0]
            if mime_type == 'application/json':
                response = json_response(config.parser.parse(content.decode()))
                response.headers.append(("Vary", "Accept"))
                response.headers.append(("ETag", obj.decode()))
                return response
            elif mime_type == 'text/html':
                metadata, html = config.parser.convert(content.decode())
                title = metadata.get("title_t", ["Untitled"])[0]
                response = HTTPResponse(content_type='text/html; charset=utf-8')
                response.headers.append(("Vary", "Accept"))
                template = engine.get_template(f'{ext}.html')
                response.write_bytes(template.render({"title": title, "html": html}).encode())
                return response
            elif mime_type in (content_type, '*/*'):
                if content_type == 'text/plain':
                    response = HTTPResponse(content_type='text/plain; charset=utf-8')
                    response.headers.append(("Vary", "Accept"))
                    response.headers.append(("ETag", obj.decode()))
                    response.write_bytes(content)
                    return response
                metadata = config.parser.parse(content.decode())
                response = HTTPResponse(content_type=content_type)
                title = metadata.get("title_t", [None])[0]
                response.headers.append(("Vary", "Accept"))
                if title:
                    response.headers.append(("Content-Disposition", "attachment; filename="+quote(title)))
                sendfile(response, f, fullname)
                return response

        return http_error(406)


def repo_file(request, filename):
    if os.path.basename(filename).startswith("."):
        return not_found()

    repo = config.repo

    if request.method == 'GET':
        commit = repo.get_latest_commit()
        return get_repo_file(request, commit, filename)

    parser = config.parser
    token = request.environ.get("HTTP_AUTHORIZATION", '')
    if not token.startswith('Bearer '):
        return unauthorized()
    email = token[7:]
    author = formataddr((get_name(email), email))

    if request.method == 'PUT':
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])
        body = request.stream.read(request.content_length)
        meta = json.loads(body) if body else {}

        if not create_new_txt(filename, meta, author=author, author_time=date):
            return http_error(409)

        return json_response("OK")

    elif request.method == 'POST':
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])

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
            commit = repo.replace_content(commit, filename, parser.format(new_content), f'Update: {filename}', author, date)
            if commit:
                spawn_indexer()
                break

        return get_repo_file(request, commit, filename)

    elif request.method == 'PATCH':
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])
        match = request.environ['HTTP_IF_MATCH']
        patch = json.loads(request.stream.read(request.content_length))

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

            new_commit = repo.replace_content(commit, filename, parser.format(metadata), f'Update: {filename}', author, date)
            if new_commit:
                spawn_indexer()
                break

        return get_repo_file(request, new_commit, filename)
    else:
        return method_not_allowed()


def upload_file(request):
    if request.method == 'POST':
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])
        token = request.environ.get("HTTP_AUTHORIZATION", '')
        if not token.startswith('Bearer '):
            return unauthorized()
        email = token[7:]
        author = formataddr((get_name(email), email))

        f = request.files.get('file', [None])[0]

        filename = import_file(f.filename, f.file, author=author, author_time=date)
        return json_response(filename)
    return method_not_allowed()

def default_page():
    response = HTTPResponse(content_type='text/html; charset=utf-8')
    template = engine.get_template('main.html')
    response.write(
        template.render({
            "EDITOR": config._config.EDITOR,
            "EDITOR_URL": config.editor.url,
            "PLUGINS": config._config.PLUGINS}))
    return response

def authenticate(request):
    if request.method == 'POST':
        if check_passwd(request.form['email'], request.form['password']):
            return json_response(request.form['email'])
        return unauthorized()
    return method_not_allowed()

def change_password(request):
    token = request.environ.get("HTTP_AUTHORIZATION", '')
    if not token.startswith('Bearer '):
        return unauthorized()
    email = token[7:]
    author = formataddr((get_name(email), email))

    if request.method == 'POST':
        if not check_passwd(email, request.form['password']):
            return unauthorized()
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])
        username, domain = email.split('@', 1)
        replace_passwd(username, domain, request.form['new_password'], author=author, author_time=date)
        return json_response(email)
    return method_not_allowed()

def router_middleware(options):
    def middleware(request, following):
        handler, args = router.match(request.environ["PATH_INFO"])
        args.pop('route_name', None)
        if handler is not None:
            return handler(request, **args)
        if request.method == 'GET':
            return default_page()
        return method_not_allowed()
    return middleware

urls = [
    ("/static/vendor/{name:any}", vendor_file),
    ("/static/{name:any}", static_file),
    ("/files/{filename:any}", repo_file),
    ("/files/", upload_file),
    ("/search/", search),
    ("/hypothesis/", hypothesis_urls),
    ("/authenticate", authenticate),
    ("/change-password", change_password),
]

router = PathRouter()
router.add_routes(urls)

application = WSGIApplication(
    [bootstrap_http_defaults, router_middleware],
    {'MAX_CONTENT_LENGTH': 1024**3})


def run_server():
    from wsgiref.simple_server import make_server
    try:
        print("Visit http://127.0.0.1:8080/")
        make_server("", 8080, application).serve_forever()
    except KeyboardInterrupt:
        pass
