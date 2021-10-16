from wheezy.routing import url
from .hypothesis import hypothesis_urls
from .wsb import wsb_urls
from .auth import auth_urls
from .openid import openid_urls
from .views import (
    vendor_file,
    static_file,
    ChangesHandler,
    SearchHandler,
    TextHandler,
    UserHandler,
    MaffHandler,
    MediaFileHandler,
    UploadHandler)

all_urls = [
    url("static/vendor/{name:any}", vendor_file),
    url("static/{name:any}", static_file),
    url("hypothesis/", hypothesis_urls),
    url("wsb/", wsb_urls),
    url("auth/", auth_urls),
    url("changes", ChangesHandler),
    url("openid/", openid_urls),
    url("search/", SearchHandler),
    url("{basename}.maff!/{path:any}", MaffHandler),
    url("{path}.txt", TextHandler),
    url("~{username}", UserHandler),
    url("{filename}", MediaFileHandler),
    url("", UploadHandler)
]

