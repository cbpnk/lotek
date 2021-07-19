import os
from wheezy.routing import PathRouter
from wheezy.http import WSGIApplication, bootstrap_http_defaults, HTTPResponse, not_found, unauthorized, method_not_allowed, json_response, http_error
from wheezy.template.engine import Engine
from wheezy.template.ext.core import CoreExtension
from wheezy.template.loader import FileLoader, autoreload
from mimetypes import guess_type
from email.utils import parsedate_to_datetime
import jsonpatch
import json
from urllib.request import urlretrieve
from shutil import move
from .config import config
from .hypothesis import hypothesis_urls
from .index import spawn_indexer
from .accounts import check_passwd
from .utils import create_new_markdown

try:
    import uwsgi
except ImportError:
    uwsgi = None

engine = autoreload(Engine(
    loader=FileLoader([os.path.join(os.path.dirname(__file__), 'templates')]),
    extensions=[CoreExtension()]))
STATIC_ROOT = os.path.join(os.path.dirname(__file__), 'static')
CACHE_ROOT = config.CACHE_ROOT

def sendfile(response, f, filename):
    if uwsgi:
        response.headers.append(("X-Sendfile", os.path.abspath(filename)))
    else:
        response.write_bytes(f.read())

def vendor_file(request, name):
    filename = os.path.join(config.CACHE_ROOT, name)
    try:
        f = open(filename, 'rb')
    except FileNotFoundError:
        local_filename, headers = urlretrieve(f'https://cdn.jsdelivr.net/{name}')
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        move(local_filename, filename)
        f = open(filename, 'rb')

    response = HTTPResponse(content_type=guess_type(name)[0] or "application/octet-stream")

    with f:
        sendfile(response, f, filename)
    return response

def static_file(request, name):
    filename = os.path.join(STATIC_ROOT, name)
    try:
        f = open(filename, 'rb')
    except FileNotFoundError:
        return not_found()

    response = HTTPResponse(content_type=guess_type(name)[0])
    with f:
        sendfile(response, f, filename)
    return response


def search(request):
    if request.method == 'GET':
        return default_page()
    elif request.method == 'POST':
        q = request.form.get("q", "")
        if q:
            q = "path:*.md " + q
            return json_response([hit.fields() for hit in config.index.search(q)])
        return json_response([])

def get_markdown_file(request, commit, filename):
    obj = config.repo.get_object(commit, filename)
    if obj is None:
        return not_found()
    content = config.repo.get_data(obj)

    accept_header = request.environ.get('HTTP_ACCEPT', 'text/plain')
    for mime_type in accept_header.split(","):
        mime_type = mime_type.strip().split(";", 1)[0]
        if mime_type == 'application/json':
            response = json_response(config.parser.convert(content.decode()))
            response.headers.append(("Vary", "Accept"))
            response.headers.append(("ETag", obj.decode()))
            return response
        elif mime_type in ('text/plain', 'text/markdown', 'text/x-markdown', '*/*'):
            response = HTTPResponse(content_type='text/plain; charset=utf-8')
            response.headers.append(("Vary", "Accept"))
            response.headers.append(("ETag", obj.decode()))
            response.write_bytes(content)
            return response

    return http_error(406)

def markdown_file(request, path):
    token = request.environ.get("HTTP_AUTHORIZATION", '')
    if not token.startswith('Bearer '):
        return unauthorized()
    email = token[7:]

    filename = f'{path}.md'
    repo = config.repo
    parser = config.parser

    if request.method == 'GET':
        commit = repo.get_latest_commit()
        return get_markdown_file(request, commit, filename)
    elif request.method == 'PUT':
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])
        body = request.stream.read(request.content_length)
        meta = json.loads(body) if body else {}

        if not create_new_markdown(filename, meta):
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
            commit = repo.replace_content(commit, filename, parser.format(new_content), f'Update: {filename}', date)
            if commit:
                spawn_indexer()
                break

        return get_markdown_file(request, commit, filename)

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

            new_commit = repo.replace_content(commit, filename, parser.format(metadata), f'Update: {filename}', date)
            if new_commit:
                spawn_indexer()
                break

        return get_markdown_file(request, new_commit, filename)
    else:
        return method_not_allowed()


def pdf_file(request, path):
    filename = f'{path}.pdf'

    if request.method == 'GET':
        fullname = os.path.join(config._config.REPO_ROOT, 'media', filename)
        try:
            f = open(fullname, 'rb')
        except FileNotFoundError:
            return not_found()

        with f:
            accept_header = request.environ.get('HTTP_ACCEPT', 'text/html')

            for mime_type in accept_header.split(","):
                mime_type = mime_type.strip().split(";", 1)[0]
                if mime_type == 'text/html':
                    response = HTTPResponse(content_type='text/html; charset=utf-8')
                    response.headers.append(("Vary", "Accept"))
                    template = engine.get_template('pdf.html')
                    response.write(template.render({"PDF_URL": f"/files/{path}.pdf"}))
                    return response
                elif mime_type in ("application/pdf", "*/*"):
                    response = HTTPResponse(content_type='application/pdf')
                    response.headers.append(("Vary", "Accept"))
                    sendfile(response, f, fullname)
                    return response
        return http_error(406)
    else:
        return method_not_allowed()

def default_page():
    response = HTTPResponse(content_type='text/html; charset=utf-8')
    template = engine.get_template('main.html')
    response.write(template.render({"EDITOR": config._config.EDITOR, "EDITOR_URL": config.editor.url}))
    return response

def authenticate(request):
    if request.method == 'POST':
        if check_passwd(request.form['email'], request.form['password']):
            return json_response(request.form['email'])
        return unauthorized()
    return method_not_allowed()

def router_middleware(options):
    def middleware(request, following):
        handler, args = router.match(request.environ["PATH_INFO"])
        args.pop('route_name', None)
        if handler is not None:
            return handler(request, **args)
        return default_page()
    return middleware

urls = [
    ("/static/vendor/{name:any}", vendor_file),
    ("/static/{name:any}", static_file),
    ("/files/{path:any}.md", markdown_file),
    ("/files/{path:any}.pdf", pdf_file),
    ("/search/", search),
    ("/hypothesis/", hypothesis_urls),
    ("/authenticate", authenticate)
]

router = PathRouter()
router.add_routes(urls)

application = WSGIApplication(
    [bootstrap_http_defaults, router_middleware],
    {})


def run_server():
    from wsgiref.simple_server import make_server
    try:
        print("Visit http://127.0.0.1:8080/")
        make_server("", 8080, application).serve_forever()
    except KeyboardInterrupt:
        pass
