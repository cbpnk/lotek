from getpass import getpass
from email.utils import formataddr
from .config import config
from .index import spawn_indexer
from .utils import create_new_txt

def mkpasswd(plaintext, crypted=None):
    from crypt import crypt, mksalt, METHOD_BLOWFISH
    method = getattr(config._config, 'CRYPT_METHOD', METHOD_BLOWFISH)
    return crypt(plaintext, crypted or mksalt(method))

def replace_passwd(username, password, **kwargs):
    passwd = mkpasswd(password)
    repo = config.repo
    filename = f".htpasswd"
    while True:
        commit = repo.get_latest_commit()
        users = {}
        if commit:
            obj = repo.get_object(commit, filename)
            if obj:
                users = dict(
                    line.split(':', 1)
                    for line in repo.get_data(obj).decode().splitlines())

        users[username] = passwd
        content = ''.join(f"{a}:{b}\n" for a, b in sorted(users.items()))

        commit = repo.replace_content(commit, filename, content.encode(), f"Update password of {username}", **kwargs)
        if commit:
            break


def run_useradd():
    from .index import run_indexer
    username = input("User: ")
    name = input("Name: ") or username
    password = getpass("Password: ")
    confirm = getpass("Confirm: ")
    assert password == confirm

    filename = f"~{username}"
    meta = {"title_t": [name], "category_i": ["user"]}
    assert create_new_txt(filename, meta), "user already exist"
    replace_passwd(username, password)
    run_indexer()

def ensure_user(username, fullname):
    name = fullname or username
    filename = f"~{username}"
    meta = {"title_t": [name], "category_i": ["user"]}
    create_new_txt(filename, meta)
    from .index import spawn_indexer
    spawn_indexer()


def run_passwd(username):
    password = getpass("Password: ")
    confirm = getpass("Confirm: ")
    assert password == confirm
    replace_passwd(username, password)

def check_passwd(username, password):
    repo = config.repo
    commit = repo.get_latest_commit()
    if not commit:
        return False
    filename = f".htpasswd"
    obj = repo.get_object(commit, filename)
    if not obj:
        return False

    users = dict(
        line.split(':', 1)
        for line in repo.get_data(obj).decode().splitlines())

    if username not in users:
        return False

    return mkpasswd(password, users[username]) == users[username]

def get_name(username):
    repo = config.repo
    parser = config.parser
    commit = repo.get_latest_commit()
    filename = f"~{username}"
    obj = repo.get_object(commit, filename)
    if obj is None:
        return
    metadata = parser.parse(repo.get_data(obj).decode())
    return metadata.get("title_t", [None])[0]


def get_addr(username):
    name = get_name(username)
    if name is None:
        return
    return formataddr((name, f"{username}@{config.DOMAIN}"))

def get_names(username_list):
    if not username_list:
        return
    from whoosh.query import Or, Term
    terms = [
        Term("path", f"~{username}")
        for username in username_list]
    q = Or(terms)

    for hit in config.index.search(q, limit=len(terms)):
        path = hit["path"]
        username = path[1:]
        d = {"path": path}
        name = hit.get("title_t", [None])[0]
        if name:
            d["name"] = name
        yield username, d
