from wheezy.http import HTTPResponse, not_found, method_not_allowed, json_response, http_error, unauthorized
import json
from datetime import datetime
from random import choices
from urllib.parse import parse_qs
from email.utils import formataddr
from .accounts import get_name
from .config import config
from .index import spawn_indexer

def api(request):
    host = request.environ['HTTP_HOST']
    path = request.environ['PATH_INFO']
    scheme = request.environ['wsgi.url_scheme']
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

    response = HTTPResponse(content_type='application/json')
    response.write(
        json.dumps({'links': LINKS})
    )
    return response


def api_links(request):
    response = HTTPResponse(content_type='application/json')
    response.write(
        json.dumps(
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
    )
    return response



def api_token(request):
    response = HTTPResponse(content_type='application/json')
    response.write(
        json.dumps(
            {"access_token": request.form['assertion'],
             "expires_in": 3600,
             "token_type": "Bearer"
             }
        )
    )
    return response

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
    response = HTTPResponse(content_type='application/json')
    response.write(json.dumps([DEFAULT_GROUP]))
    return response

def api_groups(request):
    response = HTTPResponse(content_type='application/json')
    response.write(json.dumps([DEFAULT_GROUP]))
    return response

def api_profile(request):
    token = request.environ.get("HTTP_AUTHORIZATION", '')
    if not token.startswith('Bearer '):
        return unauthorized()
    host = request.environ['HTTP_HOST']
    response = HTTPResponse(content_type='application/json')
    email = token[7:]
    response.write(json.dumps(
        {"authority": host,
         "features": {},
         "preferences": {},
         "userid": f"acct:{email}",
         "user_info": {"display_name": get_name(email)}
        }))
    return response

def reconstruct_link(obj, key, prefix):
    if not obj[key].startswith("/"):
        return
    obj[key] = prefix + obj[key][1:]

def normalize_annotation(payload, id, prefix):
    reconstruct_link(payload, "uri", prefix)
    for target in payload["target"]:
        reconstruct_link(target, "source", prefix)
    for link in payload.get("document", {}).get("link", []):
        reconstruct_link(link, "href", prefix)
    payload["permissions"] = {
        "read": [f'group:{payload["group"]}'],
        "update": [payload["user"]],
        "delete": [payload["user"]]
    }
    payload["id"] = id.replace("/", "-")
    email = payload["user"][5:]
    payload["user_info"] = {"display_name":  get_name(email)}

def get_row(hit, repo, commit, prefix):
    path = hit["path"].split("#annotations:", 1)[1].replace("-", "/")+".h.json"
    obj = repo.get_object(commit, path)
    data = repo.get_data(obj)
    payload = json.loads(data)
    normalize_annotation(payload, path[:-7], prefix)
    return payload

def api_search(request):
    repo = config.repo

    scheme = request.environ["wsgi.url_scheme"]
    host = request.environ["HTTP_HOST"]
    prefix = f"{scheme}://{host}/files/"

    qs = parse_qs(request.environ["QUERY_STRING"])

    from whoosh.query import And, Or, Term, Wildcard

    q = []
    for link in qs["uri"]:
        if link.startswith(prefix):
            link = "/" + link[len(prefix):]
        q.append(Term("uri_i", link))
    q = And([
        Or(q),
        Term("category_i", "annotation"),
        Term("group_i", qs["group"][0])
    ])
    commit = repo.get_latest_commit()

    rows = [get_row(hit, repo, commit, prefix) for hit in config.index.search(q, sortedby="created_d")]

    response = HTTPResponse(content_type='application/json')
    response.write(json.dumps(
        {"rows": rows,
         "total": len(rows),
        }))
    return response

def rewrite_link(obj, key, prefix):
    if not obj[key].startswith(prefix):
        return
    obj[key] = "/" + obj[key][len(prefix):]


def random_name():
    return ''.join(choices('0123456789abcdef', k=3))

def clean_annotation(payload, prefix):
    rewrite_link(payload, "uri", prefix)
    for target in payload["target"]:
        rewrite_link(target, "source", prefix)
    for link in payload.get("document", {}).get("link", []):
        rewrite_link(link, "href", prefix)
    created = payload["created"]
    if created.endswith("Z"):
        payload['created'] = created[:-1] + "+00:00"
    updated = payload.get("updated", None)
    if updated and updated.endswith("Z"):
        payload['updated'] = updated[:-1] + "+00:00"
    del payload["permissions"]


def api_annotation_create(request):
    scheme = request.environ["wsgi.url_scheme"]
    host = request.environ["HTTP_HOST"]
    prefix = f"{scheme}://{host}/files/"

    payload = json.loads(request.stream.read(request.content_length))
    clean_annotation(payload, prefix)
    date = datetime.fromisoformat(payload['created'])
    content = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',',':'))
    email = payload["user"][5:]
    author = formataddr((get_name(email), email))

    repo = config.repo
    while True:
        filename = f'{random_name()}/{random_name()}/{random_name()}.h.json'
        commit = repo.get_latest_commit()
        if repo.get_object(commit, filename) is not None:
            continue
        if repo.replace_content(commit, filename, content.encode(), f'Create: {filename}', author, date):
            spawn_indexer()
            break

    normalize_annotation(payload, filename[:-7], prefix)
    return json_response(payload)

def api_annotation(request, id):
    filename = id.replace("-", "/") + ".h.json"
    if request.method in ("PUT", "PATCH"):
        scheme = request.environ["wsgi.url_scheme"]
        host = request.environ["HTTP_HOST"]
        prefix = f"{scheme}://{host}/files/"

        payload = json.loads(request.stream.read(request.content_length))
        clean_annotation(payload, prefix)
        date = datetime.fromisoformat(payload['updated'])
        content = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',',':'))
        email = payload["user"][5:]
        author = formataddr((get_name(email), email))

        repo = config.repo
        while True:
            commit = repo.get_latest_commit()
            if repo.get_object(commit, filename) is None:
                return not_found()

            if repo.replace_content(commit, filename, content.encode(), f'Update: {filename}', author, date):
                spawn_indexer()
                break

        normalize_annotation(payload, filename[:-7], prefix)
        return json_response(payload)
    return method_not_allowed()


hypothesis_urls = [
    ("api/", api),
    ("api/search", api_search),
    ("api/links", api_links),
    ("api/token", api_token),
    ("api/groups", api_groups),
    ("api/profile", api_profile),
    ("api/profile/groups", api_profile_groups),
    ("api/annotations/{id}", api_annotation),
    ("api/annotations", api_annotation_create),
]
