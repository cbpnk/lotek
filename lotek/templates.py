import os
from warnings import catch_warnings
from html import escape
from json import dumps

from wheezy.web.templates import WheezyTemplate
from wheezy.template.engine import Engine
from wheezy.template.ext.core import CoreExtension
from wheezy.template.ext.code import CodeExtension
from wheezy.template.loader import FileLoader, autoreload

def Template(path):
    engine = Engine(
    loader=FileLoader([path]),
    extensions=[CoreExtension(), CodeExtension()])

    with catch_warnings(record=True):
        engine = autoreload(engine)

    engine.global_vars.update(
        {'e': lambda x: escape(x, False),
         'a': escape,
         'json': dumps})

    return WheezyTemplate(engine)
