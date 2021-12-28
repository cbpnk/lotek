from urllib.parse import urljoin

from commonmark import commonmark

from .wopi import WOPIBaseHandler

class Handler(WOPIBaseHandler):

    def render_html(self):
        info = self.get_info()
        content = self.get_content().read()
        html = commonmark(content.decode())

        return self.render_response(
            'markdown.html',
            TITLE = info["BaseFileName"] + info['FileExtension'],
            HTML = html,
            WOPISrc = self.src,
            hypothesis_url = urljoin(info['PostMessageOrigin'], "/")
        )
