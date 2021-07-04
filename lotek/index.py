import sys
import os
from subprocess import Popen


try:
    import uwsgi

    from uwsgidecorators import mulefunc

    @mulefunc
    def _spawn_indexer():
        run_indexer()

    def spawn_indexer(config):
        _spawn_indexer()

except ImportError:
    def spawn_indexer(config):
        env = os.environ.copy()
        if config.CONFIG_FILE:
            env["LOTEK_CONFIG"] = config.CONFIG_FILE
        Popen(["python", "-m", __package__, "index"], executable=sys.executable, env=env)


def tokenlist(values, analyzer, chars=False, positions=False, **kwargs):
    for value in values:
        for t in analyzer(value, chars=chars, positions=positions, **kwargs):
            yield t
        if chars:
            kwargs['start_char'] = t.endchar + 1
        if positions:
            kwargs['start_pos'] = t.pos + 2

def tokens(value, analyzer, kwargs):
    from whoosh.analysis import unstopped

    if isinstance(value, (tuple, list)):
        gen = tokenlist(value, analyzer, **kwargs)
    else:
        gen = analyzer(value, **kwargs)
    return unstopped(gen)

def run_indexer():
    from .config import config
    from whoosh.index import open_dir, create_in, EmptyIndexError, LockError
    from markdown import Markdown

    INDEX_ROOT = config._config.INDEX_ROOT

    repo = config.repo
    parser = config.parser

    from whoosh import formats
    formats.tokens = tokens

    try:
        ix = open_dir(INDEX_ROOT)
    except EmptyIndexError:
        from whoosh.fields import Schema, ID, TEXT, NUMERIC, DATETIME
        schema = Schema(
            path=ID(unique=True, stored=True),
            content=TEXT())
        schema.add("*_i", ID(stored=True), glob=True)
        schema.add("*_t", TEXT(stored=True), glob=True)
        schema.add("*_n", NUMERIC(stored=True), glob=True)
        schema.add("*_d", DATETIME(stored=True), glob=True)
        os.makedirs(INDEX_ROOT, exist_ok=True)
        ix = create_in(INDEX_ROOT, schema)

    try:
        writer = ix.writer()
    except LockError:
        return

    head = repo.get_latest_commit()
    indexed_commit = repo.get_indexed_commit()
    if head == indexed_commit:
        return

    for path, content, is_new in repo.diff_commit(indexed_commit, head):
        metadata, content = parser.parse(content)
        if is_new:
            writer.add_document(path=path, content=content, **metadata)
        else:
            writer.update_document(path=path, content=content, **metadata)

    repo.update_indexed_commit(indexed_commit, head)
    writer.commit()


class Index:

    def __init__(self, config):
        from whoosh.index import open_dir
        from whoosh.qparser import QueryParser, GtLtPlugin
        self.ix = open_dir(config.INDEX_ROOT)
        self.qp = QueryParser("content", schema=self.ix.schema)
        self.qp.add_plugin(GtLtPlugin())

    def search(self, query):
        q = self.qp.parse(query)

        with self.ix.searcher() as searcher:
            for hit in searcher.search(q, collapse="path"):
                yield hit


def run_search(query):
    from .config import config
    for hit in config.index.search(query):
        print(hit["path"], hit.fields())
