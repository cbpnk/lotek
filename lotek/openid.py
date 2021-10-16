from urllib.parse import urlencode
from urllib.request import urlopen, Request

from wheezy.http import redirect
from wheezy.web.handlers import BaseHandler
from wheezy.security import Principal

from .config import config
from .accounts import ensure_user

def openid_redirect(request):
    next = request.query.get("next", ["/"])[0]
    scheme = request.environ["wsgi.url_scheme"]
    host = request.environ["HTTP_HOST"]
    baseurl = f"{scheme}://{host}/"

    params = urlencode(
        {"openid.ns": "http://specs.openid.net/auth/2.0",
	 "openid.ns.sreg": "http://openid.net/extensions/sreg/1.1",
	 "openid.sreg.required": "nickname",
	 "openid.sreg.optional": "fullname,email",
	 "openid.realm": baseurl,
	 "openid.mode": "checkid_setup",
	 "openid.return_to": baseurl + "openid/callback?" + urlencode({"next": next}),
	 "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
	 "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"})

    return redirect(
        config._config.OPENID_ENDPOINT + "?" + params
    )


def find_sreg_ns(query):
    for name, value in query.items():
        if not name.startswith("openid.ns."):
            continue
        if value == "http://openid.net/extensions/sreg/1.1":
            return name[10:]

class CallbackHandler(BaseHandler):

    def get(self):
        query = self.request.query.copy()
        next = query.pop("next", ["/"])[0]
        query = {k: v[0] for k, v in query.items()}
        query["openid.mode"] = "check_authentication"

        response = urlopen(
            Request(
                method='POST',
                url=config._config.OPENID_ENDPOINT,
                data=urlencode(query).encode()))
        result = dict(line.split(b":", 1) for line in response.read().splitlines())
        if result.get(b"is_valid", b"false") == b"true":
            ns = find_sreg_ns(query)
            if ns:
                email = query.get(f"openid.{ns}.email", None)
                fullname = query.get(f"openid.{ns}.fullname", None)
                if email:
                    username, domain = email.split("@", 1)
                    if domain == config.DOMAIN:
                        ensure_user(username, fullname)
                        self.principal = Principal(username)
        return redirect(next)


openid_urls = [
    ("redirect", openid_redirect),
    ("callback", CallbackHandler),
]
