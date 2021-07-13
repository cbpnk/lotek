import sys
import os

import argparse

parser = argparse.ArgumentParser(description='')
subparsers = parser.add_subparsers(help='sub-command help', dest='COMMAND', required=True)
parser_serve = subparsers.add_parser('serve')
parser_index = subparsers.add_parser('index')

parser_search = subparsers.add_parser('search')
parser_search.add_argument('query')

parser_import = subparsers.add_parser('import')
parser_import.add_argument('-m', '--mode', choices=('copy', 'link', 'move'), default='copy')
parser_import.add_argument('filename')

parser_useradd = subparsers.add_parser('useradd')
parser_passwd = subparsers.add_parser('passwd')
parser_passwd.add_argument('email')

args = parser.parse_args()
if args.COMMAND == 'serve':
    from .wsgi import run_server
    run_server()
elif args.COMMAND == 'index':
    from .index import run_indexer
    run_indexer()
elif args.COMMAND == 'search':
    from .index import run_search
    run_search(args.query)
elif args.COMMAND == 'import':
    from .utils import run_import
    run_import(args.filename, args.mode)
elif args.COMMAND == 'useradd':
    from .accounts import run_useradd
    run_useradd()
elif args.COMMAND == 'passwd':
    from .accounts import run_passwd
    run_passwd(args.email)
