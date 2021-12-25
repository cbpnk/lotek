from urllib.parse import urljoin

from .wopi import WOPIBaseHandler


class Handler(WOPIBaseHandler):

    def render_html(self):
        url, timestamp, signature = self.sign_wopi()
        info = self.get_info()

        return self.render_response(
            'pdf.html',
            TITLE = info["BaseFileName"] + info['FileExtension'],
            PDF_URL = self.src,
            PROXY_PDF_URL = url,
            PDF_HTTP_HEADERS = {
                'X-WOPI-TIMESTAMP': str(timestamp),
                'X-WOPI-PROOF': signature,
                'X-WOPI-PROOFOLD': signature,
            },
            access_token = self.access_token,
            hypothesis_url = urljoin(self.src, "/")
        )
