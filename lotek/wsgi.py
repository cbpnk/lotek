import os
from importlib import import_module

from wheezy.http import WSGIApplication
from wheezy.web.middleware import bootstrap_defaults, path_routing_middleware_factory
from wheezy.security.crypto import Ticket
from wheezy.routing import url

from .templates import Template
from .config import load_config
from .wopi import refresh_clients

from .static import all_urls as static_urls
from .auth import all_urls as auth_urls
from .hypothesis import all_urls as hypothesis_urls
from .wsb import all_urls as wsb_urls
from .views import all_urls as lotek_urls
from .clients.wopi import discovery


config = load_config(os.environ.get(__package__.replace(".", "_").upper() + '_CONFIG', None))

enabled_clients = {
    name
    for actions in config.CLIENT_FORMATS.values()
    for name in actions.values()
}

mods = {
    name: import_module(f"{__package__}.clients.{name}")
    for name in enabled_clients
}

client_urls = [
    ("", discovery)
] + [
    url(f"{name}.html", mod.Handler, name=name)
    for name, mod in mods.items()
] + [
    (f"{name}/", mod.all_urls)
    for name, mod in mods.items()
    if hasattr(mod, 'all_urls')
]

all_urls = [
    ("static/", static_urls),
    ("auth/", auth_urls),
    ("hypothesis/", hypothesis_urls),
    ("wsb/", wsb_urls),
    ("clients/", client_urls),
    ("", lotek_urls),
]

application = WSGIApplication(
    [bootstrap_defaults(url_mapping=all_urls),
     path_routing_middleware_factory],
    {'MAX_CONTENT_LENGTH': 1024**3,
     'render_template': Template(os.path.join(os.path.dirname(__file__), 'templates')),
     'ticket': Ticket(max_age=36000),
     'STATIC_ROOTS': [config.STATIC_ROOT, os.path.join(os.path.dirname(__file__), 'static')],
     'STATIC_VENDOR_ROOT': config.STATIC_VENDOR_ROOT,
     'PLUGINS': config.PLUGINS,
     'AUTH_DOMAIN': config.AUTH_DOMAIN,
     'BASE_URL': config.BASE_URL,
     'HOST_FORMATS': config.HOST_FORMATS,
     'repo': config.repo,
     'users': config.users,
     'formats': config.formats,
     'index': config.index,
     'proof_key': config.proof_key,
     'CLIENT_FORMATS': config.CLIENT_FORMATS})

import uwsgi

def refresh_timer(num):
    refresh_clients(config.WOPI_CLIENTS, application, config.BASE_URL)

def update_index(num):
    config.index.update()

uwsgi.register_signal(1, 'workers', refresh_timer)
uwsgi.add_rb_timer(1, 0, 1)
uwsgi.add_rb_timer(1, 3600)
uwsgi.register_signal(2, 'mule', update_index)
