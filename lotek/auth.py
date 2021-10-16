import json
from email.utils import parsedate_to_datetime, parseaddr

from wheezy.core.descriptors import attribute
from wheezy.web import handlers, handler_cache, authorize
from wheezy.http import CacheProfile, method_not_allowed, unauthorized
from wheezy.security import Principal

from .config import config
from .accounts import check_passwd, replace_passwd, get_addr

vary_accept_profile = CacheProfile('none', no_store=True, http_vary=('Accept',))

class BaseHandler(handlers.BaseHandler):

    def __call__(self):
        method = self.request.method
        if method == "GET":
            response = self.get()
        elif method == "POST":
            response = self.post()
        elif method == "HEAD":
            response = self.head()
        elif method == "PUT":
            response = self.put()
        elif method == "PATCH":
            response = self.patch()
        elif method == "OPEN":
            response = self.open()
        else:
            response = method_not_allowed()
        if self.cookies:
            response.cookies.extend(self.cookies)
        return response

    def put(self):
        """Responds to HTTP PUT requests."""
        return method_not_allowed()

    def patch(self):
        """Responds to HTTP PATCH requests."""
        return method_not_allowed()

    def open(self):
        """Responds to HTTP OPEN requests."""
        return method_not_allowed()

    @handler_cache(vary_accept_profile)
    def get(self):
        return self.render_response(
            'main.html',
            EDITOR=json.dumps(config._config.EDITOR),
            EDITOR_URL=json.dumps(config.editor.url),
            PLUGINS=[json.dumps(p) for p in config._config.MEDIA_FORMATS + config._config.PLUGINS],
            CSRF_TOKEN=json.dumps(self.xsrf_token),
            USER_ID=json.dumps(self.principal.id if self.principal is not None else None))

    @attribute
    def date(self):
        return parsedate_to_datetime(self.request.environ['HTTP_X_LOTEK_DATE'])

    @attribute
    def author(self):
        return get_addr(self.principal.id)


class LoginHandler(BaseHandler):

    def post(self):
        if not check_passwd(self.request.form['username'], self.request.form['password']):
            return unauthorized()

        self.principal = Principal(id=self.request.form['username'])
        return self.json_response(self.principal.id)

class LogoutHandler(BaseHandler):

    def post(self):
        del self.principal
        return self.json_response("OK")


class ChangePasswordHandler(BaseHandler):

    @authorize
    def post(self):
        username = self.principal.id
        if not check_passwd(username, request.form['password']):
            return unauthorized()
        replace_passwd(username, request.form['new_password'], author=self.author, author_time=self.date)
        return self.json_response(username)


auth_urls = [
    ("login", LoginHandler),
    ("logout", LogoutHandler),
    ("change-password", ChangePasswordHandler)
]
