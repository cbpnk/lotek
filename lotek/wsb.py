from wheezy.http import HTTPResponse, not_found, redirect, unauthorized, method_not_allowed, json_response, http_error
from secrets import token_bytes
from base64 import b64decode
import jwt
import time

from .index import spawn_indexer
from .utils import import_file
from .accounts import check_passwd, get_addr

JWT_SECRET = token_bytes()

def action_config(request):
    return json_response(
        {"success": True,
         "data":
         {"app": {
             "name": "WebScrapBook",
             "theme": "default",
             "base": "/wsb",
             "is_local": False},
          "book": {
              "": {
                  "name": "scrapbook",
                  "top_dir": "",
                  "data_dir": "",
                  "tree_dir": ".wsb/tree",
                  "index": ".wsb/tree/map.html",
                  "no_tree": True
              }
          },
          "WSB_DIR": ".wsb",
          "WSB_CONFIG": "config.ini",
          "WSB_EXTENSION_MIN_VERSION": "0.79.0",
          "VERSION": "0.44.1"}}
    )

def action_token(request):
    if request.method == 'POST':
        token = jwt.encode({"exp": time.time() + 1800}, JWT_SECRET, algorithm="HS256")
        return json_response({"success": True, "data":token})

def action_unknown(request):
    return not_found()

def check_auth(auth):
    if not auth:
        return
    if not auth.startswith("Basic "):
        return
    auth = b64decode(auth[6:]).decode().split(":", 1)
    if len(auth) < 2:
        auth = [auth[0], '']
    username, password = auth
    if not check_passwd(username, password):
        return
    return get_addr(username)

def auth_required(f):
    def wrapper(request, *args, **kwargs):
        auth = request.environ.get('HTTP_AUTHORIZATION', None)
        user = check_auth(auth)
        if not user:
            response = unauthorized()
            response.headers.append(("WWW-Authenticate", f'Basic realm="WebScrapBook"'))
            return response
        request.user = user
        return f(request, *args, **kwargs)
    return wrapper

@auth_required
def scrapbooks(request):
    action = request.query.get("a", ["unknown"])[0]
    handler = globals().get(f'action_{action}', action_unknown)
    return handler(request)

@auth_required
def scrapbooks_maff(request):
    name = request.environ['route_args']['name']
    if request.method == 'GET':
        return json_response(
            {"success": True,
             "data": {
                 "name": f"{name}.maff",
                 "type": None,
                 "size": None,
                 "last_modified": None,
                 "mime": "application/x-maff"}})
    elif request.method == 'POST':
        action = request.query.get("a", ["unknown"])[0]
        if action == 'save':
            f = request.files.get("upload", [None])[0]
            import_file("index.maff", f.file, author=request.user)
            spawn_indexer()

            response = HTTPResponse()
            response.status_code = 204
            return response


wsb_urls = [
    ("", scrapbooks),
    ("{name}.maff", scrapbooks_maff)
]
