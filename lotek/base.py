import json
from email.utils import parsedate_to_datetime, formataddr

from wheezy.core.descriptors import attribute
from wheezy.web import handlers, handler_cache
from wheezy.http import method_not_allowed, forbidden, http_error

import uwsgi


class BaseHandler(handlers.BaseHandler):

    def __call__(self):
        method = self.request.method
        if method == "GET":
            response = self.get()
        elif method == "HEAD":
            response = self.head()
        elif method in ("POST", "PUT", "PATCH"):
            if not self.validate_csrf_token():
                return forbidden()
            else:
                if method == "POST":
                    response = self.post()
                elif method == "PUT":
                    response = self.put()
                elif method == "PATCH":
                    response = self.patch()
        else:
            response = method_not_allowed()
        if self.cookies:
            response.cookies.extend(self.cookies)
        response.headers.append(("X-Frame-Options", "SAMEORIGIN"))
        return response

    def validate_csrf_token(self):
        token = self.request.environ.get("HTTP_X_CSRF_TOKEN", None)
        return token == self.xsrf_token

    def put(self):
        """Responds to HTTP PUT requests."""
        return method_not_allowed()

    def patch(self):
        """Responds to HTTP PATCH requests."""
        return method_not_allowed()

    @handler_cache()
    def get(self):
        accept_header = self.request.environ.get('HTTP_ACCEPT', 'text/html')
        for mime_type in accept_header.split(","):
            mime_type = mime_type.strip().split(";", 1)[0]
            if mime_type == 'text/html':
                response = self.get_html()
                break
            elif mime_type == 'application/json':
                response = self.get_json()
                break
        else:
            response = http_error(406)

        response.headers.append(('Vary', 'Accept, Origin'))
        return response

    def get_json(self):
        return http_error(406)

    def get_html(self):
        formats = self.options['formats']
        return self.render_response(
            'main.html',
            PLUGINS=self.options["PLUGINS"],
            CSRF_TOKEN=self.xsrf_token,
            USER={"id": self.principal.id, "display_name": self.principal.alias} if self.principal is not None else None,
            FORMATS=[
                {"name": getattr(formats, ext).NAME, "ext": ext}
                for ext in sorted(formats.__all__)
                if hasattr(getattr(formats, ext), "init_new_file")])

    @attribute
    def date(self):
        date = self.request.environ.get('HTTP_X_LOTEK_DATE', None)
        if date is None:
            date = self.request.environ['HTTP_DATE']
        return parsedate_to_datetime(date)

    @attribute
    def author(self):
        return formataddr((self.principal.alias, self.principal.id + "@" + self.options["AUTH_DOMAIN"]))

    def update_index(self):
        uwsgi.signal(2)
