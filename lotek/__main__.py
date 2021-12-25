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


if sys.modules['__main__'].__package__ == __package__:
    config_file = os.environ.get(__package__.upper() + '_CONFIG', None)
else:
    config_file = sys.modules['__main__'].__file__

from .config import load_config

config = load_config(config_file)


args = parser.parse_args()

if args.COMMAND == 'useradd':
    from getpass import getpass

    user_id = input("User ID: ")
    display_name = input("Display Name: ") or user_id
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
        print(hit["path"], hit.fields())
elif args.COMMAND == 'import':
    from .files import import_file
    file_id, new = import_file(config.repo, config.formats, args.filename, mode=args.mode)
    if new:
        config.index.update()

quit()
