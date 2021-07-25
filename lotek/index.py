import sys
import os
from subprocess import Popen


try:
    import uwsgi

    from uwsgidecorators import mulefunc

    @mulefunc
    def spawn_indexer():
        run_indexer()
except ImportError:
    def spawn_indexer():
        from .config import config
        env = os.environ.copy()
        if config.CONFIG_FILE:
            env["LOTEK_CONFIG"] = config.CONFIG_FILE
        Popen(["python", "-m", __package__, "index"], executable=sys.executable, env=env)


def tokenlist(values, analyzer, chars=False, positions=False, **kwargs):
    for value in values:
        for t in analyzer(value, chars=chars, positions=positions, **kwargs):
            yield t
        else:
            continue
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
    from datetime import datetime, timezone
    import json

    INDEX_ROOT = config._config.INDEX_ROOT

    repo = config.repo
    parser = config.parser

    from whoosh import formats
    formats.tokens = tokens

    from .fields import NGRAMCJKTEXT

    try:
        ix = open_dir(INDEX_ROOT)
    except EmptyIndexError:
        from whoosh.fields import Schema, ID, NUMERIC, DATETIME
        schema = Schema(
            path=ID(unique=True, stored=True),
            content=NGRAMCJKTEXT(stored=True))
        schema.add("*_i", ID(stored=True), glob=True)
        schema.add("*_t", NGRAMCJKTEXT(stored=True), glob=True)
        schema.add("*_n", NUMERIC(stored=True), glob=True)
        schema.add("*_d", DATETIME(stored=True), glob=True)
        os.makedirs(INDEX_ROOT, exist_ok=True)
        ix = create_in(INDEX_ROOT, schema)

    while True:
        try:
            writer = ix.writer()
        except LockError:
            return

        with writer:
            head = repo.get_latest_commit()
            indexed_commit = repo.get_indexed_commit()
            if head == indexed_commit:
                return

            for path, content, is_new in repo.diff_commit(indexed_commit, head):
                if os.path.basename(path).startswith("."):
                    continue

                if path.endswith(".h.json"):
                    annotation = json.loads(content)
                    date = datetime.fromisoformat(annotation["created"]).astimezone(timezone.utc)
                    func = writer.add_document if is_new else writer.update_document
                    basepath = annotation["uri"][1:] + "#annotations:"
                    annotation_id = path[:-7].replace("/", "-")

                    func(
                        path=basepath + annotation_id,
                        content=annotation["text"],
                        category_i=["annotation"],
                        group_i=[annotation["group"]],
                        created_d=[date],
                        tag_t=annotation["tags"],
                        reference_i=[basepath+r for r in annotation.get("references", [])],
                        uri_i=[annotation["uri"]]+[link["href"] for link in annotation.get("document", {}).get("link", [])]
                    )
                else:
                    metadata = parser.parse(content)
                    func = writer.add_document if is_new else writer.update_document
                    func(path=path, **metadata)

            repo.update_indexed_commit(indexed_commit, head)


class Index:

    def __init__(self, config):
        from whoosh.index import open_dir
        from whoosh.qparser import MultifieldParser, GtLtPlugin
        self.ix = open_dir(config.INDEX_ROOT)
        self.qp = MultifieldParser(["title_t", "content"], schema=self.ix.schema)
        self.qp.add_plugin(GtLtPlugin())

    def search(self, query, *, highlighter=None, **kwargs):
        if isinstance(query, str):
            q = self.qp.parse(query)
        else:
            q = query

        with self.ix.searcher() as searcher:
            results = searcher.search(q, collapse="path", **kwargs)
            if highlighter:
                results.highlighter = highlighter
            for hit in results:
                yield hit


def run_search(query):
    from .config import config
    for hit in config.index.search(query):
        print(hit["path"], hit.fields())
