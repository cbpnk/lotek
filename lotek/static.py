import os
from mimetypes import guess_type
from urllib.request import urlretrieve
from urllib.parse import quote
from shutil import move

from wheezy.web.handlers import BaseHandler
from wheezy.core.descriptors import attribute
from wheezy.http import HTTPResponse, not_found, none_cache_profile
from wheezy.web import handler_cache


class FileResponse(HTTPResponse):

    def __init__(self, name, size):
        super().__init__(content_type=guess_type(name)[0] or "application/octet-stream")
        self.name = name
        self.size = size
        self.headers.append(("Accept-Ranges", "bytes"))
        self.write_bytes(self)

    def __len__(self):
        return self.size

    def __call__(self, start_response):
        super().__call__(start_response)
        return []


class FileHandler(BaseHandler):

    @handler_cache(none_cache_profile)
    def head(self):
        filename = self.filename
        if not filename:
            return not_found()

        size = os.path.getsize(filename)
        return FileResponse(filename, size)

    @handler_cache(none_cache_profile)
    def get(self):
        filename = self.filename
        if not filename:
            return not_found()

        response = HTTPResponse(content_type=guess_type(filename)[0] or "application/octet-stream")
        response.headers.append(("X-Sendfile", os.path.abspath(filename)))
        return response


class StaticFileHandler(FileHandler):

    @attribute
    def filename(self):
        path = self.route_args["path"]
        for root in self.options['STATIC_ROOTS']:
            filename = os.path.join(root, path)
            if os.path.exists(filename):
                return filename


class VendorFileHandler(FileHandler):

    @attribute
    def filename(self):
        path = self.route_args["path"]
        filename = os.path.join(self.options['STATIC_VENDOR_ROOT'], path)
        if not os.path.exists(filename):
            local_filename, headers = urlretrieve(f'https://cdn.jsdelivr.net/{quote(path,safe="@/")}')
            os.makedirs(os.path.dirname(filename), exist_ok=True)
            move(local_filename, filename)
        return filename


all_urls = [
    ("vendor/{path:any}", VendorFileHandler),
    ("{path:any}", StaticFileHandler)
]
