from time import time
from urllib.parse import parse_qs
from datetime import datetime
from email.utils import formataddr
import json
from random import choices

from wheezy.http import HTTPResponse, not_found, method_not_allowed, json_response, http_error, unauthorized, forbidden
from wheezy.security import Principal
from wheezy.web import handlers, handler_cache
from wheezy.core.descriptors import attribute

import uwsgi

from .utils import get_names


def api(request):
    environ = request.environ
    host = environ['HTTP_HOST']
    path = environ['PATH_INFO']
    scheme = environ['wsgi.url_scheme']
    prefix = f"{scheme}://{host}{path}"
    LINKS = {
        'annotation': {
            'create': {
                "method": "POST",
                "url": f"{prefix}annotations"
            },
            'delete': {
                "method": "DELETE",
                "url": f"{prefix}annotations/:id"
            },
            'read': {
                "method": "GET",
                "url": f"{prefix}annotations/:id"
            },
            'update': {
                "method": "PATCH",
                "url": f"{prefix}annotations/:id"
            },
            'flag': {
                "method": "PUT",
                "url": f"{prefix}annotations/:id/flag"
            },
            'hide': {
                "method": "PUT",
                "url": f"{prefix}annotations/:id/hide"
            },
            'unhide': {
                "method": "DELETE",
                "url": f"{prefix}annotations/:id/hide"
            }
        },
        'search': {
            "method": "GET",
            "url": f"{prefix}search"
        },
        'bulk': {
            "method": "POST",
            "url": f"{prefix}bulk"
        },

        'group': {
            'member': {
                "add": {
                    'method': "POST",
                    "url": f"{prefix}groups/:pubid/members/:userid"
                },
                "delete": {
                    'method': "DELETE",
                    "url": f"{prefix}groups/:pubid/members/:userid"
                },
            },
            'create': {
                'method': "POST",
                "url": f"{prefix}groups"
            },
            'read': {
                'method': "GET",
                "url": f"{prefix}groups/:id"
            },
            'members': {
                "read": {
                    'method': "GET",
                    "url": f"{prefix}groups/:pubid/members"
                },
            },
            'update': {
                'method': "PATCH",
                "url": f"{prefix}groups/:id"
            },
            'create_or_update': {
                'method': "PUT",
                "url": f"{prefix}groups/:id"
            }
        },

        'groups': {
            "read": {
                "method": "GET",
                "url": f"{prefix}groups",
            }
        },
        'index': {
            "method": "GET",
            "url": f"{prefix}",
        },
        'links': {
            "method": "GET",
            "url": f"{prefix}links"
        },
        'profile': {
            "read": {
                "method": "GET",
                "url": f"{prefix}profile"
            },
            "groups": {
                "read": {
                    "method": "GET",
                    "url": f"{prefix}profile/groups"
                }
            },
            "update": {
                "method": "PATCH",
                "url": f"{prefix}profile"
            }
        },
        'user': {
            'create': {
                'method': "POST",
                "url": f"{prefix}users"
            },
            'read': {
                'method': "GET",
                "url": f"{prefix}users/:userid",
            },
            'update': {
                'method': "PATCH",
                "url": f"{prefix}users/:username",
            }
        }
    }

    return json_response({'links': LINKS})


def api_links(request):
    return json_response(
        {"accounts.settings": "/hypothesis/account/settings",
         "forget-password": "/hypothesis/forget-password",
         "groups.new": "/hypothesis/groups/new",
         "help": "/hypothesis/docs/help",
         "oauth.authorize": "/hypothesis/oauth/authorized",
         "oauth.revoke": "/hypothesis/oauth/revoke",
         "search.tag": "/hypothesis/search",
         "signup": "/hypothesis/signup",
         "user": "/hypothesis/u/:user",
         })


def api_token(request):
    form = request.form
    grant_type = form['grant_type'][0]
    if grant_type == 'urn:ietf:params:oauth:grant-type:jwt-bearer':
        token = form['assertion'][0]

        principal, ttl = request.options['ticket'].decode(token)
        if principal is None:
            return forbidden()

        return json_response(
            {"access_token": token,
             "expires_in": ttl,
             "token_type": "Bearer"})


DEFAULT_GROUP = {
    "id": "public",
    "groupid": "public",
    "name": "Public",
    "links": {},
    "organization": None,
    "scopes": {
        "enforced": False,
        "uri_patterns": [],
    },
    "scoped": False,
    "type": "open",
}

def api_profile_groups(request):
    return json_response([DEFAULT_GROUP])

def api_groups(request):
    return json_response([DEFAULT_GROUP])


class BaseHandler(handlers.BaseHandler):

    def __call__(self):
        if not self.principal:
            return unauthorized()

        method = self.request.method
        if method == "GET":
            response = self.get()
        elif method == "HEAD":
            response = self.head()
        elif method == "POST":
            response = self.post()
        elif method == "PUT":
            response = self.put()
        elif method == "PATCH":
            response = self.patch()
        elif method == "DELETE":
            response = self.delete()
        else:
            response = method_not_allowed()
        if self.cookies:
            response.cookies.extend(self.cookies)
        return response

    @attribute
    def principal(self):
        token = self.request.environ.get("HTTP_AUTHORIZATION", '')
        if not token.startswith('Bearer '):
            return
        dump, _ = self.options['ticket'].decode(token[7:])
        if not dump:
            return
        return Principal.load(dump)

    @attribute
    def prefix(self):
        environ = self.request.environ
        scheme = environ["wsgi.url_scheme"]
        host = environ["HTTP_HOST"]
        return f"{scheme}://{host}/"

    def update_index(self):
        uwsgi.signal(2)


class ProfileHandler(BaseHandler):

    def get(self):
        principal = self.principal
        AUTH_DOMAIN = self.options['AUTH_DOMAIN']
        return json_response(
            {"authority": AUTH_DOMAIN,
             "features": {},
             "preferences": {},
             "userid": f"acct:{principal.id}@{AUTH_DOMAIN}",
             "user_info": {"display_name": principal.alias}
             })


def reconstruct_link(obj, key, prefix):
    if not obj.get(key, "").startswith("/"):
        return
    obj[key] = prefix + obj[key][1:]

def normalize_annotation(payload, id, prefix, AUTH_DOMAIN):
    user = payload.pop("user")
    payload["user"] = f"acct:{user}@{AUTH_DOMAIN}"

    reconstruct_link(payload, "uri", prefix)
    for target in payload["target"]:
        reconstruct_link(target, "source", prefix)
    reconstruct_link(payload.get("document", {}), "favicon", prefix)
    for link in payload.get("document", {}).get("link", []):
        reconstruct_link(link, "href", prefix)
    payload["permissions"] = {
        "read": [f'group:{payload["group"]}'],
        "update": [payload["user"]],
        "delete": [payload["user"]]
    }
    payload["id"] = id
    del payload['type']


def get_row(hit, repo, commit, prefix, AUTH_DOMAIN):
    record_id = hit["id"]
    info = repo.get_record_info(commit, record_id)
    normalize_annotation(info.props, record_id, prefix, AUTH_DOMAIN)
    return info.props


class SearchHandler(BaseHandler):

    def get(self):
        options = self.options
        AUTH_DOMAIN = options['AUTH_DOMAIN']
        repo = options['repo']
        index = options['index']
        prefix = options['BASE_URL']
        qs = parse_qs(self.request.environ["QUERY_STRING"])

        from whoosh.query import And, Or, Term, DateRange

        q = []
        for link in qs["uri"]:
            if link.startswith(prefix):
                link = "/" + link[len(prefix):]
            q.append(Term("uri_s", link))
        q = And([
            Or(q),
            Term("type", "annotation"),
            Term("group_s", qs["group"][0])
        ])
        commit = repo.get_latest_commit()

        limit = qs.get("limit", [None])[0]
        if limit:
            limit = int(limit)
        sort = qs.get("sort", ["updated"])[0]

        if sort == "created":
            sortedby = "created_d"
        elif sort == "updated":
            sortedby = "updated_d"
        else:
            assert False, f"unknown sort param: {sort}"

        search_after = qs.get("search_after", [None])[0]
        if search_after is not None:
            q = And([DateRange(sortedby, datetime.fromisoformat(search_after), None), q])

        order = qs.get("order", ["desc"])[0]
        if order == "asc":
            reverse = False
        elif order == "desc":
            reverse = True
        else:
            assert False, f"unknown reverse param: {sort}"

        rows = [
            get_row(hit, repo, commit, prefix, AUTH_DOMAIN)
            for hit in index.search(q, sortedby=sortedby, reverse=reverse, limit=limit)]

        usernames = {
            username:d["name"]
            for username, d in get_names(index, set(row["user"][5:].split("@", 1)[0] for row in rows))
            if "name" in d}

        for row in rows:
            row["user_info"] = {"display_name": usernames.get(row["user"][5:].split("@", 1)[0], None)}

        return self.json_response(
            {"rows": rows,
             "total": len(rows),
             })

def rewrite_link(obj, key, prefix):
    if not obj.get(key, "").startswith(prefix):
        return
    obj[key] = "/" + obj[key][len(prefix):]

def random_name():
    return ''.join(choices('0123456789abcdef', k=9))

def clean_annotation(payload, prefix):
    rewrite_link(payload, "uri", prefix)
    for target in payload["target"]:
        rewrite_link(target, "source", prefix)

    document = payload.get("document", {})
    rewrite_link(document, "favicon", prefix)
    links = document.get("link", [])
    if links:
        if any(link.get("rel", "") == "canonical" for link in links):
            document["link"] = [link for link in links if link.get("rel", "") == "canonical"]
    for link in document.get("link", []):
        rewrite_link(link, "href", prefix)
    created = payload["created"]
    if created.endswith("Z"):
        payload['created'] = created[:-1] + "+00:00"
    updated = payload.get("updated", None)
    if updated and updated.endswith("Z"):
        payload['updated'] = updated[:-1] + "+00:00"
    del payload["permissions"]
    payload["user"] = payload["user"][5:].split("@", 1)[0]
    payload['type'] = 'annotation'

class AnnotationCreateHandler(BaseHandler):

    def post(self):
        request = self.request
        options = self.options
        AUTH_DOMAIN = options['AUTH_DOMAIN']
        prefix = options['BASE_URL']
        payload = json.loads(request.stream.read(request.content_length))
        clean_annotation(payload, prefix)
        props = payload.copy()
        del props["user_info"]

        date = datetime.fromisoformat(props['created'])
        principal = self.principal
        author = formataddr((principal.alias, principal.id + "@" + AUTH_DOMAIN))

        repo = options['repo']

        while True:
            record_id = random_name()
            commit = repo.get_latest_commit()
            if repo.get_record_info(commit, record_id):
                return False
            if repo.put_record(commit, record_id, props, None, f'Add annotation {record_id} to {props["uri"][1:]}', author, date):
                self.update_index()
                break

        normalize_annotation(payload, record_id, prefix, AUTH_DOMAIN)
        return self.json_response(payload)


class AnnotationHandler(BaseHandler):

    def get(self):
        options = self.options
        record_id = self.route_args["id"]
        prefix = options['BASE_URL']
        AUTH_DOMAIN = options['AUTH_DOMAIN']

        repo = options['repo']
        commit = repo.get_latest_commit()
        info = repo.get_record_info(commit, record_id)
        if info is None or info.props["type"] != "annotation":
            return not_found()

        payload = info.props.copy()
        normalize_annotation(payload, record_id, prefix, AUTH_DOMAIN)
        return self.json_response(payload)


    def put(self):
        request = self.request
        options = self.options
        AUTH_DOMAIN = options['AUTH_DOMAIN']
        record_id = self.route_args["id"]
        prefix = options['BASE_URL']
        payload = json.loads(request.stream.read(request.content_length))
        clean_annotation(payload, prefix)
        props = payload.copy()
        del props["user_info"]
        del props["id"]

        date = datetime.fromisoformat(props['updated'])
        principal = self.principal
        author = formataddr((principal.alias, principal.id + "@" + AUTH_DOMAIN))

        repo = options['repo']

        while True:
            commit = repo.get_latest_commit()
            info = repo.get_record_info(commit, record_id)
            if info is None or info.props["type"] != "annotation":
                return not_found()

            if repo.put_record(commit, record_id, props, None, f'Update annotation {record_id} to {props["uri"][1:]}', author, date):
                self.update_index()
                break

        normalize_annotation(payload, record_id, prefix, AUTH_DOMAIN)
        return self.json_response(payload)

    def patch(self):
        return self.put()

    def delete(self):
        record_id = self.route_args["id"]
        options = self.options
        request = self.request
        AUTH_DOMAIN = options['AUTH_DOMAIN']

        repo = options['repo']
        principal = self.principal
        author = formataddr((principal.alias, principal.id + "@" + AUTH_DOMAIN))

        while True:
            commit = repo.get_latest_commit()
            info = repo.get_record_info(commit, record_id)
            if info is None or info.props["type"] != "annotation":
                return not_found()

            if repo.delete_record(commit, record_id, f'Delete annotation {record_id} to {info.props["uri"][1:]}', author):
                self.update_index()
                break

        return self.json_response(
            {"deleted": True,
             "id": record_id})


all_urls = [
    ("api/", api),
    ("api/search", SearchHandler),
    ("api/links", api_links),
    ("api/token", api_token),
    ("api/groups", api_groups),
    ("api/profile", ProfileHandler),
    ("api/profile/groups", api_profile_groups),
    ("api/annotations/{id}", AnnotationHandler),
    ("api/annotations", AnnotationCreateHandler)
]
