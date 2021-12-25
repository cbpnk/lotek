from urllib.error import HTTPError

from .wopi import WOPIBaseHandler


class Handler(WOPIBaseHandler):

    def render_html(self):
        info = self.get_info()
        response = self.get_content()
        version = response.headers['X-WOPI-ItemVersion']
        return self.render_response(
            'textarea.html',
            TITLE = info["BaseFileName"] + info['FileExtension'],
            CONTENT = response.read().decode(),
            X_WOPI_ItemVersion = version,
            access_token = self.access_token)

    def handle_form(self):
        form = self.request.form
        content = form.get('content', [None])[0]
        version = form.get('X-WOPI-ItemVersion', [None])[0]
        try:
            self.put_content(version, content.encode())
        except HTTPError as e:
            if e.status != 412:
                raise
        return self.render_html()
