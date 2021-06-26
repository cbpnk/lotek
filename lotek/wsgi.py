import os
from wheezy.routing import PathRouter
from wheezy.http import WSGIApplication, bootstrap_http_defaults, HTTPResponse, not_found, json_response, http_error
from wheezy.template.engine import Engine
from wheezy.template.ext.core import CoreExtension
from wheezy.template.loader import FileLoader, autoreload
from mimetypes import guess_type
from email.utils import parsedate_to_datetime
from random import choices
import jsonpatch
import json
from .config import config
from .index import spawn_indexer

engine = autoreload(Engine(
    loader=FileLoader([os.path.join(os.path.dirname(__file__), 'templates')]),
    extensions=[CoreExtension()]))
STATIC_ROOT = os.path.join(os.path.dirname(__file__), 'static')

def static_file(request, name):
    try:
        f = open(os.path.join(STATIC_ROOT, name), 'rb')
    except FileNotFoundError:
        return not_found()

    response = HTTPResponse(content_type=guess_type(name)[0])
    with f:
        response.write_bytes(f.read())
    return response

def search(request):
    if request.method == 'GET':
        return default_page()
    elif request.method == 'POST':
        q = request.form.get("q", "")
        if q:
            return json_response([hit.fields() for hit in config.index.search(q)])
        return json_response([])

def random_name():
    return ''.join(choices('0123456789abcdef', k=3))

def create_new_file(request):
    if request.method == 'POST':
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])
        body = b''

        repo = config.repo
        parser = config.parser

        while True:
            path = f'{random_name()}/{random_name()}/{random_name()}.md'
            filename = path.encode()

            commit = repo.get_latest_commit()
            if repo.get_object(commit, filename) is not None:
                continue

            if repo.replace_content(commit, filename, b'', f'Create: {path}'.encode(), date):
                break

        metadata = config.editor.create_new_file(filename)
        meta = ''.join(
            ''.join(f'{key}: {value}\n' for value in metadata[key])
            for key in sorted(metadata))
        while True:
            commit = repo.get_latest_commit()
            if repo.replace_content(commit, filename, meta.encode(), f"Setup: {path}".encode(), date):
                break
        spawn_indexer(config)
        return json_response(path)


def markdown(request, path):
    filename = path.encode() + b'.md'

    if request.method == 'GET':
        accept_header = request.environ.get('HTTP_ACCEPT', 'text/html')

        for mime_type in accept_header.split(","):
            mime_type = mime_type.strip().split(";", 1)[0]
            if mime_type == 'text/html':
                return default_page()
            elif mime_type == 'application/json':
                commit = config.repo.get_latest_commit()
                obj = config.repo.get_object(commit, filename)
                if obj is None:
                    return not_found()
                content = obj.data
                response = json_response(config.parser.convert(content.decode()))
                response.headers.append(("ETag", obj.id.decode()))
                return response
        return not_found()
    elif request.method == 'PUT':
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])
        repo = config.repo

        commit = repo.get_latest_commit()
        assert commit is None
        repo.replace_content(None, b'home.md', b'', b'Initial commit', date)

        metadata = config.editor.create_new_file(filename)
        meta = ''.join(
            ''.join(f'{key}: {value}\n' for value in metadata[key])
            for key in sorted(metadata))
        while True:
            commit = repo.get_latest_commit()
            if repo.replace_content(commit, b'home.md', meta.encode(), f"Setup: home.md".encode(), date):
                break
        spawn_indexer(config)
        return json_response("OK")


    elif request.method == 'POST':
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])
        repo = config.repo
        parser = config.parser

        while True:
            commit = repo.get_latest_commit()
            obj = repo.get_object(commit, filename)

            metadata, _ = parser.parse(obj.data.decode())
            new_content = config.editor.get_new_content(filename, metadata)
            if not new_content:
                break
            metadata, body = new_content

            meta = ''.join(
                ''.join(f'{key}: {value}\n' for value in metadata[key])
                for key in sorted(metadata))

            commit = repo.replace_content(commit, filename, meta.encode() + b'\n' + body.encode(), f'Update: {filename}'.encode(), date)
            if commit:
                spawn_indexer(config)
                break

        obj = repo.get_object(commit, filename)
        content = obj.data
        metadata, body = parser.parse(content.decode())
        d = parser.convert(body)
        metadata["content"] = d["content"]
        response = json_response(metadata)
        response.headers.append(("ETag", obj.id.decode()))
        return response

    elif request.method == 'PATCH':
        repo = config.repo
        parser = config.parser
        date = parsedate_to_datetime(request.environ['HTTP_X_LOTEK_DATE'])
        match = request.environ['HTTP_IF_MATCH']
        patch = json.loads(request.stream.read(request.content_length))

        while True:
            commit = repo.get_latest_commit()
            obj = repo.get_object(commit, filename)
            content = obj.data
            metadata, body = parser.parse(content.decode())

            if obj.id.decode() != match:
                return http_error(412)

            metadata = jsonpatch.apply_patch(metadata, patch)
            empty_keys = [key for key in metadata if not metadata[key]]
            for key in empty_keys:
                del metadata[key]

            meta = ''.join(
                ''.join(f'{key}: {value}\n' for value in metadata[key])
                for key in sorted(metadata))

            new_commit = repo.replace_content(commit, filename, meta.encode() + body.encode(), f'Update: {filename}'.encode(), date)
            if new_commit:
                obj = repo.get_object(new_commit, filename)
                d = parser.convert(body)
                metadata["content"] = d["content"]
                response = json_response(metadata)
                response.headers.append(("ETag", obj.id.decode()))
                spawn_indexer(config)
                return response


def default_page():
    response = HTTPResponse(content_type='text/html; charset=utf-8')
    template = engine.get_template('main.html')
    response.write(template.render({"EDITOR_URL": config.editor.url}))
    return response

def router_middleware(options):
    def middleware(request, following):
        handler, args = router.match(request.environ["PATH_INFO"])
        args.pop('route_name', None)
        if handler is not None:
            return handler(request, **args)
        return default_page()
    return middleware

urls = [
    ("/static/{name:any}", static_file),
    ("/files/", create_new_file),
    ("/files/{path:any}.md", markdown),
    ("/search/", search)
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
