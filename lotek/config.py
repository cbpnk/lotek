import sys
import os
from types import ModuleType
from functools import cached_property
from pkg_resources import working_set

def load_entry_point(group, name):
    for dist in working_set:
        ep = dist.get_entry_info(group, name)
        if ep is None:
            continue
        return ep.load()
    raise ImportError("Entry point %r not found" % ((group, name),))


class Config:

    def __init__(self, mod):
        self._config = mod
        self.CONFIG_FILE = mod.__file__
        self.CACHE_ROOT = mod.CACHE_ROOT

    @cached_property
    def repo(self):
        from .git import GitRepo
        return GitRepo(self._config)

    @cached_property
    def parser(self):
        return load_entry_point(f"{__package__}_txt_formats", self._config.TXT_FORMAT)(self._config)

    @cached_property
    def index(self):
        from .index import Index
        return Index(self._config)

    @cached_property
    def editor(self):
        return load_entry_point(f"{__package__}_editors", self._config.EDITOR)(self._config)


def load_config(filename):
    mod = ModuleType('__config__')
    sys.modules['__config__'] = mod
    d = mod.__dict__

    if filename:
        mod.__file__ = filename
        with open(filename, 'r') as f:
            code = compile(f.read(), filename, 'exec')
        exec(code, d)

    d.setdefault('EDITOR', 'textarea')
    d.setdefault('EDITOR_URL', 'http://127.0.0.1:9001')
    d.setdefault('TXT_FORMAT', 'markdown')
    d.setdefault('REPO_ROOT', 'git')
    d.setdefault('INDEX_ROOT', 'index')
    d.setdefault('CACHE_ROOT', 'cache')
    d.setdefault('__file__', None)
    return Config(mod)

if sys.modules['__main__'].__package__ == __package__:
    config = load_config(os.environ.get('LOTEK_CONFIG', None))
else:
    try:
        import uwsgi
        config = load_config(None)
    except ImportError:
        config = load_config(sys.modules['__main__'].__file__)
