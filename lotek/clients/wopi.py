from io import BytesIO
from urllib.request import urlopen, Request
from urllib.parse import urlencode, urlparse, urljoin
from base64 import b64encode
import xml.etree.ElementTree as ET
from time import time
from email.utils import formatdate
import json

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding

from wheezy.web.handlers import BaseHandler
from wheezy.http import HTTPResponse
from wheezy.core.descriptors import attribute
from wheezy.http.functional import WSGIClient, EMPTY_STREAM


def discovery(request):
    options = request.options
    numbers = options['proof_key'].public_key().public_numbers()
    path_for = options['path_for']
    url = options["BASE_URL"]

    root = ET.Element('wopi-discovery')
    net_zone = ET.SubElement(root, "net-zone", {"name": "external-http"})
    app = ET.SubElement(net_zone, "app", {"name": __package__.split(".")[0]})

    for ext, actions in request.options['CLIENT_FORMATS'].items():
        for action, client in actions.items():
            ET.SubElement(app, "action", {"ext": ext, "name": action, "urlsrc": url + path_for(client) + "?"})

    exponent = b64encode(int.to_bytes(numbers.e, 3, 'big')).decode()
    modulus = b64encode(int.to_bytes(numbers.n, 256, 'big')).decode()

    # typedef struct _PUBLICKEYSTRUC {
    #   BYTE   bType;    // 6 PUBLICKEYBLOB
    #   BYTE   bVersion; // 2
    #   WORD   reserved; // 0
    #   ALG_ID aiKeyAlg; // 0x0000a400 CALG_RSA_KEYX
    # } BLOBHEADER, PUBLICKEYSTRUC;
    # _RSAPUBKEY {
    #   DWORD magic;  // "RSA1"
    #   DWORD bitlen; // 0x100
    #   DWORD pubexp; // 0x10001
    # } RSAPUBKEY;
    value = b64encode(b'\x06\x02\x00\x00\x00\xa4\x00\x00RSA1' + int.to_bytes(256, 4, 'little') + int.to_bytes(numbers.e, 4, 'little') + int.to_bytes(numbers.n, 256, 'little')).decode()

    proof_key = ET.SubElement(
        root,
        'proof-key',
        {"exponent": exponent,
         "oldexponent": exponent,
         "modulus": modulus,
         "oldmodulus": modulus,
         "value": value,
         "oldvalue": value})

    response = HTTPResponse('text/xml')
    response.write_bytes(ET.tostring(root, xml_declaration=True, encoding='utf-8'))
    return response


def make_message(access_token, url, timestamp):
    return b''.join(
        (int.to_bytes(len(s), 4, 'big') + s)
        for s in [access_token.encode(), url.upper().encode(), int.to_bytes(timestamp, 8, 'big')]
    )


class WOPIBaseHandler(BaseHandler):

    @attribute
    def access_token(self):
        return self.request.form.get('access_token', [None])[0]

    @attribute
    def src(self):
        return self.request.query.get('WOPISrc', [None])[0]

    def sign_wopi(self, path="/contents"):
        access_token = self.access_token
        url = self.src + path + "?" + urlencode({"access_token": access_token})
        timestamp = int(time())
        signature = b64encode(
            self.options['proof_key'].sign(
                make_message(access_token, url.upper(), timestamp),
                padding.PKCS1v15(),
                hashes.SHA256())).decode()

        return url, timestamp, signature

    def _request(self, method, path, headers=None, data=None):
        request = self.request
        url, timestamp, signature = self.sign_wopi(path)

        headers = headers or {}
        headers.update({
            'X-WOPI-TIMESTAMP': str(timestamp),
            'X-WOPI-PROOF': signature,
            'X-WOPI-PROOFOLD': signature,
            'Date': formatdate(timestamp, usegmt=True)
        })

        if urljoin(url, "/") == self.options["BASE_URL"]:
            from ..wsgi import application
            c = WSGIClient(application)
            stream = BytesIO(data) if data is not None else EMPTY_STREAM

            o = urlparse(url)
            origin = f"{o.scheme}://{o.netloc}"

            environ = {
                "SCRIPT_NAME": "",
                "SERVER_NAME": o.hostname,
                "SERVER_PORT": str(o.port),
                "SERVER_PROTOCOL": "HTTP/1.1",
                "HTTP_HOST": o.netloc,
                "wsgi.url_scheme": o.scheme,
                "HTTP_ORIGIN": origin,
                "REQUEST_METHOD": method,
                "PATH_INFO": o.path,
                "QUERY_STRING": o.query,
                "REQUEST_URI": o.path + '?' + o.query,
                "CONTENT_LENGTH": len(data) if data is not None else 0,
                "wsgi.input": stream,
            }

            for k, v in headers.items():
                environ["HTTP_"+k.upper().replace("-", "_")] = v
            assert c.run(environ) == 200
            response = BytesIO(b"".join(c.response))
            response.headers = {k: v[0] for k, v in c.headers.items() if v}
            return response
        else:
            return urlopen(Request(url, data, headers, method=method))

    def get_content(self):
        return self._request('GET', "/contents")

    def put_content(self, version, data):
        return self._request('PUT', "/contents", {'If-Match': version}, data)

    def get_info(self):
        return json.load(self._request('GET', ""))

    def post(self):
        if self.request.form.get('X-WOPI-ItemVersion', None):
            return self.handle_form()
        return self.render_html()
