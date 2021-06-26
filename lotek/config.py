import sys
import os
from types import ModuleType
from functools import cached_property


class Config:

    def __init__(self, mod):
        self._config = mod
        self.CONFIG_FILE = mod.__file__

    @cached_property
    def repo(self):
        from .git import GitRepo
        return GitRepo(self._config)

    @cached_property
    def parser(self):
        from .markdown import MarkdownParser
        return MarkdownParser(self._config)

    @cached_property
    def index(self):
        from .index import Index
        return Index(self._config)

    @cached_property
    def editor(self):
        from .etherpad import Etherpad
        return Etherpad(self._config)


def load_config(filename):
    mod = ModuleType('__config__')
    sys.modules['__config__'] = mod
    d = mod.__dict__

    if filename:
        mod.__file__ = filename
        with open(filename, 'r') as f:
            code = compile(f.read(), filename, 'exec')
        exec(code, d)

    d.setdefault('EDITOR_URL', 'http://127.0.0.1:9001')
    d.setdefault('REPO_ROOT', 'git')
    d.setdefault('INDEX_ROOT', 'index')
    d.setdefault('__file__', None)
    return Config(mod)

if sys.modules['__main__'].__package__ == __package__:
    config = load_config(os.environ.get('LOTEK_CONFIG', None))
else:
    config = load_config(sys.modules['__main__'].__file__)
