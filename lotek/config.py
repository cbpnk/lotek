import os
from types import ModuleType
from pkg_resources import working_set
from importlib import import_module

def load_entry_point(group, name):
    for dist in working_set:
        ep = dist.get_entry_info(group, name)
        if ep is None:
            continue
        return ep.load()
    raise ImportError("Entry point %r not found" % ((group, name),))


def lazy_getattr(mod, attrs):
    def wrapper(name):
        func = attrs.get(name, None)
        if func is None:
            raise AttributeError(f"module {mod.__file__} has no attribute {name}")
        d = mod.__dict__
        value = func(mod)
        d[name] = value
        return value
    return wrapper


def lazy_repo(mod):
    return load_entry_point(f"{__package__}_repos", mod.REPO["backend"])(**mod.REPO["options"])

def lazy_mkpasswd(mod):
    import crypt
    method = getattr(crypt, 'METHOD_' + mod.CRYPT['method'])
    rounds = mod.CRYPT.get('rounds', None)
    def mkpasswd(plaintext, crypted=None):
        return crypt.crypt(plaintext, crypted or crypt.mksalt(method, rounds=rounds))
    return mkpasswd

def lazy_users(mod):
    from .users import Users
    return Users(mod.repo, mod.mkpasswd)

def lazy_base_url(mod):
    import socket
    import uwsgi
    hostname = socket.gethostbyname(socket.gethostname())
    port = uwsgi.opt['http-socket'].split(b":", 1)[1].decode()
    return f'http://{hostname}:{port}/'

def lazy_wopi_clients(mod):
    return {
        __package__: {
            "url": f"{mod.BASE_URL}clients/"
        }
    }
    #         "collaboraonline": {
    #             'url': 'http://127.0.0.1:9980/hosting/discovery',
    #             'params': [
    #                 ('ui_defaults', 'UIMode=classic')
    #             ]
    #         }
    #     }

def lazy_host_formats(mod):
    if mod.WOPI_CLIENTS.get(__package__, {}).get("url", "") == f"{mod.BASE_URL}clients/":
        return {key: __package__ for key in mod.CLIENT_FORMATS}
    return {}

def lazy_index(mod):
    from .index import Index
    return Index(mod.INDEX_ROOT, mod.repo, mod.formats)

def lazy_formats(mod):
    formats = mod.FORMATS
    mod = ModuleType('__formats__')
    d = mod.__dict__
    def getformat(name):
        modname = formats.get(name, None)
        if not modname:
            return
        d[name] = import_module(modname)
        return d[name]
    mod.__all__ = list(formats)
    mod.__getattr__ = getformat
    return mod

def lazy_proof_key(mod):
    from cryptography.hazmat.primitives.asymmetric import rsa
    return rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048)

config_attrs = {
    'repo': lazy_repo,
    'mkpasswd': lazy_mkpasswd,
    'users': lazy_users,
    'BASE_URL': lazy_base_url,
    'WOPI_CLIENTS': lazy_wopi_clients,
    'HOST_FORMATS': lazy_host_formats,
    'index': lazy_index,
    'formats': lazy_formats,
    'proof_key': lazy_proof_key,
}

def load_config(filename):
    mod = ModuleType('__config__')
    d = mod.__dict__

    d['REPO'] = {
        'backend': 'git',
        'options': {'path': 'repo'}
    }
    d['CRYPT'] = {}
    d['PLUGINS'] = ['password', 'tag', 'category', 'debug', 'kanban']
    d['STATIC_ROOT'] = 'static'
    d['AUTH_DOMAIN'] = 'localhost'
    d['INDEX_ROOT'] = 'index'

    d["CLIENT_FORMATS"] = {
        'md': {'view': 'markdown', 'edit': 'textarea'},
        'pdf': {'view': 'pdf'},
        'maff': {'view': 'maff'},
    }

    if filename:
        mod.__file__ = filename
        with open(filename, 'r') as f:
            code = compile(f.read(), filename, 'exec')
        exec(code, d)

    d['CRYPT'].setdefault('method', 'BLOWFISH')
    d.setdefault('STATIC_VENDOR_ROOT', os.path.join(d["STATIC_ROOT"], 'vendor'))

    FORMATS = {
        'maff': f'{__package__}.formats.maff',
        'md': f'{__package__}.formats.markdown',
        'odt': f'{__package__}.formats.odt',
        'pdf': f'{__package__}.formats.pdf',
    }
    FORMATS.update(d.get('FORMATS', {}))
    d['FORMATS'] = FORMATS


    mod.__getattr__ = lazy_getattr(mod, config_attrs)
    return mod
