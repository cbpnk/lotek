from wheezy.web import authorize
from wheezy.http import unauthorized
from wheezy.security import Principal

from ..base import BaseHandler


class LoginHandler(BaseHandler):

    def post(self):
        request = self.request
        user_id = request.form['user_id']

        info = self.options["users"].check_password(user_id, request.form['password'])
        if not info:
            return unauthorized()

        display_name = info.props.get('name', user_id)
        self.principal = Principal(id=user_id, alias=display_name)
        return self.json_response({"id": user_id, "display_name": display_name})


class ChangePasswordHandler(BaseHandler):

    @authorize
    def post(self):
        request = self.request
        users = self.options["users"]
        user_id = self.principal.id

        if not users.set_password(
                user_id,
                request.form['password'],
                request.form['new_password'],
                author=self.author,
                author_time=self.date):
            return unauthorized()

        return self.json_response(True)


all_urls = [
    ("login", LoginHandler),
    ("change", ChangePasswordHandler),
]
