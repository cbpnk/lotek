import json
from base64 import b64decode
from urllib.request import urlopen
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET
from traceback import print_exc

from wheezy.security import Principal
from wheezy.core.descriptors import attribute
from wheezy.http.functional import WSGIClient

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.exceptions import InvalidSignature

from .base import BaseHandler


WOPI_CLIENTS = {}


def decode_proof_key(exp, mod):
    e = int.from_bytes(b64decode(exp), 'big')
    n = int.from_bytes(b64decode(mod), 'big')
    return rsa.RSAPublicNumbers(e, n).public_key()


def refresh_clients(clients, application, base_url):
    for alias, options in clients.items():
        url = options['url']

        try:
            if urljoin(url, "/") == base_url:
                c = WSGIClient(application)
                assert c.get(urlparse(url).path) == 200
                root = ET.fromstring(c.content)
            else:
                response = urlopen(url)
                root = ET.parse(response)

            apps = [app for app in root.findall('net-zone/app')]
            proof_key = root.find('proof-key')

            formats = {}

            for app in apps:
                # name = app.attrib.get("name", None)
                # favicon = app.attrib.get("favIconUrl", None)

                for action in app.findall("action"):
                    ext = action.attrib['ext']
                    if ext == '':
                        continue
                    formats.setdefault(ext, {})
                    actions = formats[ext]
                    actions[action.attrib['name']] = action.attrib['urlsrc']

            key = decode_proof_key(proof_key.attrib['exponent'], proof_key.attrib['modulus'])
            oldkey = decode_proof_key(proof_key.attrib['oldexponent'], proof_key.attrib['oldmodulus'])

            WOPI_CLIENTS[alias] = {
                "formats": formats,
                "key": key,
                "oldkey": oldkey,
                "params": options.get('params', [])
            }
        except Exception:
            print_exc()


def make_message(access_token, url, timestamp):
    return b''.join(
        (int.to_bytes(len(s), 4, 'big') + s)
        for s in [access_token.encode(), url.upper().encode(), int.to_bytes(timestamp, 8, 'big')]
    )

def verify(public_key, signature, message):
    try:
        public_key.verify(signature, message, padding.PKCS1v15(), hashes.SHA256())
        return True
    except InvalidSignature:
        return False

class WOPIBaseHandler(BaseHandler):

    @attribute
    def record_id(self):
        return self.route_args["record_id"]

    @attribute
    def record_info(self):
        repo = self.options['repo']
        commit = repo.get_latest_commit()
        return repo.get_record_info(commit, self.record_id)

    @attribute
    def file_info(self):
        info = self.record_info
        if info and info.props.get("type", None) == 'file':
            return info

    @attribute
    def wopi_client(self):
        info = self.file_info
        if not info:
            return
        ext = info.props.get("ext", None)
        if not ext:
            return
        alias = self.options["HOST_FORMATS"][ext]
        return WOPI_CLIENTS[alias]

    @attribute
    def principal(self):
        request = self.request
        environ = request.environ
        timestamp = environ.get('HTTP_X_WOPI_TIMESTAMP', None)
        if timestamp is None:
            return super().getprincipal()

        client = self.wopi_client
        if not client:
            return

        access_token = request.query.get('access_token', [''])[0]
        timestamp = int(timestamp)
        message = b''.join(
            (int.to_bytes(len(s), 4, 'big') + s)
            for s in (
                    access_token.encode(),
                    request.urlparts.geturl().upper().encode(),
                    int.to_bytes(timestamp, 8, 'big')))

        key = client["key"]
        old_key = client["oldkey"]

        proof = b64decode(environ['HTTP_X_WOPI_PROOF'])
        old_proof = b64decode(environ['HTTP_X_WOPI_PROOFOLD'])

        assert any(verify(k, p, message) for k, p in [(key, proof), (old_key, old_proof), (old_key, proof)]), "invalid signature"

        dump, _ = self.options["ticket"].decode(access_token)
        principal = Principal.load(dump)
        principal.extra = json.loads(principal.extra)
        if principal.extra["file_id"] == self.record_id:
            return principal

    def validate_csrf_token(self):
        if 'HTTP_X_WOPI_TIMESTAMP' not in self.request.environ:
            return super().validate_csrf_token()
        if self.principal:
            return True

    def get(self):
        if 'HTTP_X_WOPI_TIMESTAMP' not in self.request.environ:
            return super().get()
        return self.get_wopi()
