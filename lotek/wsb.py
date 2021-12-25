from secrets import token_bytes
from base64 import b64decode
import time
from email.utils import formataddr

from wheezy.http import HTTPResponse, not_found, redirect, unauthorized, method_not_allowed, json_response, http_error
from wheezy.security import Principal
from wheezy.security.crypto import Ticket

import uwsgi

from .files import import_file

def auth_required(f):
    def wrapper(request, *args, **kwargs):
        auth = request.environ.get('HTTP_AUTHORIZATION', None)
        user = check_auth(request.options['users'], auth)
        if not user:
            response = unauthorized()
            response.headers.append(("WWW-Authenticate", f'Basic realm="WebScrapBook"'))
            return response
        request.user = user
        return f(request, *args, **kwargs)
    return wrapper


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

@auth_required
def action_token(request):
    if request.method == 'POST':
        ticket = request.options['ticket']
        token_ticket = Ticket()
        token_ticket.max_age = 1800
        token_ticket.cypher = ticket.cypher
        token_ticket.hmac = ticket.hmac
        token_ticket.digest_size = ticket.digest_size
        token_ticket.block_size = ticket.block_size

        token = token_ticket.encode(request.user.dump())
        return json_response({"success": True, "data": token})

def action_unknown(request):
    return not_found()

def check_auth(users, auth):
    if not auth:
        return
    if not auth.startswith("Basic "):
        return
    auth = b64decode(auth[6:]).decode().split(":", 1)
    if len(auth) < 2:
        auth = [auth[0], '']
    user_id, password = auth
    info = users.check_password(user_id, password)
    if not info:
        return

    display_name = info.props.get('name', user_id)
    return Principal(id=user_id, alias=display_name)

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
            options = request.options
            token = request.form.get("token", [None])[0]
            dump, _ = options['ticket'].decode(token)
            user = request.user
            if not dump or Principal.load(dump).id != user.id:
                return http_error(400)

            f = request.files.get("upload", [None])[0]
            file_id, new = import_file(
                options['repo'],
                options['formats'],
                f"{name}.maff",
                f.file,
                author=formataddr((user.alias, user.id + "@" + options["AUTH_DOMAIN"])))
            if new:
                uwsgi.signal(2)

            response = HTTPResponse()
            response.status_code = 204
            return response


all_urls = [
    ("", scrapbooks),
    ("{name}.maff", scrapbooks_maff)
]
