import os
from warnings import catch_warnings
from html import escape

from wheezy.http import WSGIApplication
from wheezy.web.middleware import bootstrap_defaults
from wheezy.web.middleware import path_routing_middleware_factory
from wheezy.template.engine import Engine
from wheezy.template.ext.core import CoreExtension
from wheezy.template.ext.code import CodeExtension
from wheezy.template.loader import FileLoader, autoreload
from wheezy.web.templates import WheezyTemplate

from .urls import all_urls

engine = Engine(
    loader=FileLoader([os.path.join(os.path.dirname(__file__), 'templates')]),
    extensions=[CoreExtension(), CodeExtension()])

with catch_warnings(record=True):
    engine = autoreload(engine)

engine.global_vars.update({'e': escape})

application = WSGIApplication(
    [bootstrap_defaults(url_mapping=all_urls),
     path_routing_middleware_factory],
    {'MAX_CONTENT_LENGTH': 1024**3,
     'render_template': WheezyTemplate(engine)})

def run_server():
    from wsgiref.simple_server import make_server
    try:
        print("Visit http://127.0.0.1:8080/")
        make_server("", 8080, application).serve_forever()
    except KeyboardInterrupt:
        pass
