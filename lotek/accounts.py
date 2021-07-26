from getpass import getpass
from .config import config
from .index import spawn_indexer
from .utils import create_new_txt

def mkpasswd(plaintext, crypted=None):
    from crypt import crypt, mksalt, METHOD_BLOWFISH
    method = getattr(config._config, 'CRYPT_METHOD', METHOD_BLOWFISH)
    return crypt(plaintext, crypted or mksalt(method))

def replace_passwd(username, domain, password, **kwargs):
    passwd = mkpasswd(password)
    repo = config.repo
    filename = f"users/{domain}/.htpasswd"
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

        commit = repo.replace_content(commit, filename, content.encode(), f"Update password of {username}@{domain}", **kwargs)
        if commit:
            break


def run_useradd():
    email = input("Email: ")
    username, domain = email.split('@', 1)
    name = input("Name: ") or username
    password = getpass("Password: ")
    confirm = getpass("Confirm: ")
    assert password == confirm

    filename = f"users/{domain}/{username}.txt"
    meta = {"title_t": [name], "category_i": ["user"]}
    assert create_new_txt(filename, meta), "user already exist"
    replace_passwd(username, domain, password)


def run_passwd(email):
    username, domain = email.split('@', 1)
    password = getpass("Password: ")
    confirm = getpass("Confirm: ")
    assert password == confirm
    replace_passwd(username, domain, password)

def check_passwd(email, password):
    try:
        username, domain = email.split('@', 1)
    except ValueError:
        return False
    repo = config.repo
    commit = repo.get_latest_commit()
    if not commit:
        return False
    filename = f"users/{domain}/.htpasswd"
    obj = repo.get_object(commit, filename)
    if not obj:
        return False

    users = dict(
        line.split(':', 1)
        for line in repo.get_data(obj).decode().splitlines())

    if username not in users:
        return False

    return mkpasswd(password, users[username]) == users[username]

def get_name(email):
    username, domain = email.split('@', 1)
    repo = config.repo
    parser = config.parser
    commit = repo.get_latest_commit()
    filename = f"users/{domain}/{username}.txt"
    obj = repo.get_object(commit, filename)
    metadata = parser.parse(repo.get_data(obj).decode())
    return metadata.get("title_t", [None])[0]
