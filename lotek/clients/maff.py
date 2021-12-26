from zipfile import ZipFile
from urllib.parse import urljoin, urlparse
from mimetypes import guess_type
import json

from wheezy.http import not_found, forbidden, HTTPResponse
from wheezy.security import Principal

from .wopi import WOPIBaseHandler
from ..formats.maff import get_topdir, get_indexfilename

class Handler(WOPIBaseHandler):

    def render_html(self):
        options = self.options
        src = self.src
        access_token = self.access_token
        assert urljoin(src, "/") == options["BASE_URL"]

        file_id = urlparse(src).path[1:]

        repo = options['repo']
        commit = repo.get_latest_commit()
        info = repo.get_file_info(commit, file_id)
        if not info:
            return not_found()

        with ZipFile(repo.open(info)) as maff:
            name = get_topdir(maff)
            indexfilename = get_indexfilename(maff, name)

        props = info.props
        title = props.get("name", file_id)
        ext = props.get("ext", None)
        if ext:
            title += "." + ext

        return self.render_response(
            'maff.html',
            TITLE = title,
            WOPISrc = self.src,
            indexfilename = f"/clients/maff/{access_token}/{file_id}!/{name}/{indexfilename}",
            hypothesis_url = urljoin(info['PostMessageOrigin'], "/")
        )

def handle_maff_request(request):
    route_args = request.environ["route_args"]
    access_token = route_args['access_token']
    file_id = route_args['file_id']

    dump, _ = request.options['ticket'].decode(access_token)
    principal = Principal.load(dump)
    principal.extra = json.loads(principal.extra)
    if principal.extra["file_id"] != file_id:
        return forbidden()

    path = route_args['path']
    repo = request.options['repo']
    commit = repo.get_latest_commit()
    info = repo.get_file_info(commit, file_id)
    if not info:
        return not_found()

    with ZipFile(repo.open(info)) as maff:
        try:
            f = maff.open(path)
        except KeyError:
            return not_found()

        with f:
            response = HTTPResponse(content_type=guess_type(path)[0] or "application/octet-stream")
            response.headers.append(('Content-Security-Policy', "connect-src 'none'; form-action 'none';"))
            response.write_bytes(f.read())
            return response

all_urls = [
    ("{access_token}/{file_id}!/{path:any}", handle_maff_request)
]
