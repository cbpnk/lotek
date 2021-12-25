from wheezy.web import authorize

from ..base import BaseHandler

from .password import all_urls as password_urls


class LogoutHandler(BaseHandler):

    @authorize
    def post(self):
        del self.principal
        return self.json_response(None)


all_urls = [
    ("logout", LogoutHandler),
    ("password/", password_urls)
]
