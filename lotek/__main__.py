import sys
import os

import argparse

parser = argparse.ArgumentParser(description='')
subparsers = parser.add_subparsers(help='sub-command help', dest='COMMAND', required=True)
parser_serve = subparsers.add_parser('serve')
parser_index = subparsers.add_parser('index')

parser_search = subparsers.add_parser('search')
parser_search.add_argument('query')

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
