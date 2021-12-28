from urllib.error import HTTPError

from .wopi import WOPIBaseHandler


class Handler(WOPIBaseHandler):

    def render_html(self):
        info = self.get_info()
        response = self.get_content()
        version = response.headers['X-WOPI-ItemVersion']

        accept_header = self.request.environ.get('HTTP_ACCEPT', 'text/html')
        for mime_type in accept_header.split(","):
            if mime_type == 'application/json':
                return self.json_response(
                    {"content": response.read().decode(),
                     "X-WOPI-ItemVersion": version})
            elif mime_type in ('text/html', '*/*'):
                break

        return self.render_response(
            'prosemirror-markdown.html',
            TITLE = info["BaseFileName"] + info['FileExtension'],
            CONTENT = response.read().decode(),
            X_WOPI_ItemVersion = version,
            access_token = self.access_token,
            ORIGIN = info['PostMessageOrigin'])

    def handle_form(self):
        form = self.request.form
        content = form.get('content', [None])[0]
        version = form.get('X-WOPI-ItemVersion', [None])[0]
        try:
            self.put_content(version, content.encode())
            status = 200
        except HTTPError as e:
            if e.status != 412:
                raise
            status = 412
        response = self.render_html()
        response.status_code = status
        return response
