from getpass import getpass
from .config import config
from .index import spawn_indexer

def mkpasswd(plaintext, crypted=None):
    from crypt import crypt, mksalt, METHOD_BLOWFISH
    return crypt(plaintext, crypted or mksalt(METHOD_BLOWFISH))

def replace_passwd(username, domain, passwd):
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

        commit = repo.replace_content(commit, filename, content.encode(), f"Update password of {username}@{domain}")
        if commit:
            spawn_indexer()
            break


def run_useradd():
    email = input("Email: ")
    username, domain = email.split('@', 1)
    name = input("Name: ") or username
    password = getpass("Password: ")
    confirm = getpass("Confirm: ")
    assert password == confirm
    crypted = mkpasswd(password)

    filename = f"users/{domain}/{username}.md"
    repo = config.repo

    while True:
        commit = repo.get_latest_commit()
        if commit:
            assert repo.get_object(commit, filename) is None, "user already exist"
        meta = {"title_t": [name], "category_i": ["user"]}
        if repo.replace_content(commit, filename, config.parser.format(meta, ''), f'Create {filename}'):
            break
    replace_passwd(username, domain, crypted)


def run_passwd(email):
    username, domain = email.split('@', 1)
    password = getpass("Password: ")
    confirm = getpass("Confirm: ")
    assert password == confirm
    crypted = mkpasswd(password)
    replace_passwd(username, domain, crypted)

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
