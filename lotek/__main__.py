import os
import sys
import argparse

parser = argparse.ArgumentParser(description='')
subparsers = parser.add_subparsers(help='sub-command help', dest='COMMAND', required=True)
parser_useradd = subparsers.add_parser('useradd')
parser_passwd = subparsers.add_parser('passwd')
parser_passwd.add_argument('user_id')

parser_index = subparsers.add_parser('index')
parser_search = subparsers.add_parser('search')
parser_search.add_argument('query')

parser_import = subparsers.add_parser('import')
parser_import.add_argument('-m', '--mode', choices=('copy', 'link', 'move'), default='copy')
parser_import.add_argument('filename')

parser_refresh = subparsers.add_parser('refresh')
parser_refresh.add_argument('filename')



if sys.modules['__main__'].__package__ == __package__:
    config_file = os.environ.get(__package__.upper() + '_CONFIG', None)
else:
    config_file = sys.modules['__main__'].__file__

from .config import load_config

config = load_config(config_file)


args = parser.parse_args()

if args.COMMAND == 'useradd':
    from getpass import getpass
    from pwd import getpwuid

    entry = getpwuid(os.getuid())

    user_id = input(f"User ID [default: {entry.pw_name}]: ")
    user_id = user_id.strip()
    if not user_id:
        user_id = entry.pw_name
        display_name = input(f"Display Name [default: {entry.pw_gecos}]: ") or entry.pw_gecos
    else:
        display_name = input(f"Display Name [default: {user_id}]: ") or user_id
    password = getpass("Password: ")
    confirm = getpass("Confirm: ")
    assert password == confirm

    assert config.users.create(user_id, password, display_name), f"user {user_id} already exist"
    config.index.update()
elif args.COMMAND == 'passwd':
    from getpass import getpass
    user_id = args.user_id
    password = getpass("Password: ")
    confirm = getpass("Confirm: ")
    assert password == confirm
elif args.COMMAND == 'index':
    config.index.update()
elif args.COMMAND == 'search':
    for hit in config.index.search(args.query):
        print(hit["id"], hit.fields())
elif args.COMMAND == 'import':
    from .files import import_file
    file_id, new = import_file(config.repo, config.formats, args.filename, mode=args.mode)
    if new:
        config.index.update()
elif args.COMMAND == 'refresh':
    record_id = args.filename
    repo = config.repo
    commit = repo.get_latest_commit()
    info = repo.get_record_info(commit, record_id)
    props = info.props

    ext = props["ext"]
    file_format = getattr(config.formats, ext)
    meta = file_format.extract_metadata(repo.open(info))
    props["meta"] = meta

    title = meta.get("title_t", None)
    if title:
        props["name"] = title

    new_commit = repo.put_record(commit, record_id, props, None, f"refresh {ext} file meta")
    if new_commit:
        config.index.update()

quit()
