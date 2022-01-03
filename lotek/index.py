import sys
import os
from subprocess import Popen
from datetime import datetime, timezone
import json

from whoosh.query import Wildcard
from whoosh.qparser import MultifieldParser, plugins
from whoosh.index import open_dir, create_in, EmptyIndexError, LockError
from whoosh.analysis import unstopped
from whoosh.fields import Schema, ID, NUMERIC, BOOLEAN
from whoosh.writing import BufferedWriter
from whoosh import formats

from .fields import NGRAMCJKTEXT, ISO8601


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
    if isinstance(value, (tuple, list)):
        gen = tokenlist(value, analyzer, **kwargs)
    else:
        gen = analyzer(value, **kwargs)
    return unstopped(gen)

formats.tokens = tokens


def flatten(data, prefix=()):
    for k, v in data.items():
        key = prefix+(k,)
        if isinstance(v, dict):
            yield from flatten(v, key)
        else:
            yield '.'.join(key), v

class Index:

    def __init__(self, path, repo, formats):
        try:
            ix = open_dir(path)
        except EmptyIndexError:
            schema = Schema(
                id=ID(unique=True, stored=True),
                type=ID(stored=True),
                content=NGRAMCJKTEXT(stored=True))
            schema.add("*_r", ID(stored=True), glob=True)
            schema.add("*_s", ID(stored=True), glob=True)
            schema.add("*_t", NGRAMCJKTEXT(stored=True), glob=True)
            schema.add("*_i", NUMERIC(numtype=int, bits=64, stored=True), glob=True)
            schema.add("*_f", NUMERIC(numtype=float, bits=64, stored=True), glob=True)
            schema.add("*_d", ISO8601(stored=True), glob=True)
            schema.add("*_b", BOOLEAN(stored=True), glob=True)
            os.makedirs(path, exist_ok=True)
            ix = create_in(path, schema)
        self.ix = ix
        self.repo = repo
        self.formats = formats

        self.qp = MultifieldParser(
            ["name_t", "content"],
            schema=self.ix.schema,
            plugins=[
                plugins.WhitespacePlugin(),
                plugins.SingleQuotePlugin(),
                plugins.FieldsPlugin(r"(?P<text>(?:\w|\.)+|[*]):"),
                plugins.WildcardPlugin(),
                plugins.PhrasePlugin(),
                plugins.RangePlugin(),
                plugins.GroupPlugin(),
                plugins.OperatorsPlugin(),
                plugins.BoostPlugin(),
                plugins.EveryPlugin(),
                plugins.GtLtPlugin(),
                plugins.FieldAliasPlugin({"name_t": ["name"], "ext_s": ["ext"], "size_i": ["size"]})
            ]
        )

    def update(self):
        repo = self.repo
        while True:
            with self.ix.searcher() as searcher:
                try:
                    writer = BufferedWriter(self.ix, period=0, limit=2**32)
                except LockError:
                    return

                with writer:
                    head = repo.get_latest_commit()
                    indexed_commit = repo.get_indexed_commit()
                    if head == indexed_commit:
                        return

                    for change_type, info in repo.commit_changes(indexed_commit, head):
                        if change_type in ('add', 'modify'):
                            props = info.props
                            if props["type"] == 'file':
                                attrs = props.get("attrs", {})
                                attrs["meta"] = props.get("meta", {})
                                doc = dict(flatten(attrs))
                                doc["id"] = info.record_id
                                doc["type"] = 'file'

                                for key, field in {"ext": "ext_s", "name": "name_t", "size": "size_i"}.items():
                                    value = props.pop(key, None)
                                    if value is not None:
                                        doc[field] = value

                                ext = info.ext
                                if ext:
                                    doc["content"] = ""
                                    writer.delete_by_query(Wildcard("id", f"{info.record_id}#*"))
                                    with repo.open(info) as f:
                                        for fragment, type, content in getattr(self.formats, ext).extract_content(f):
                                            if not fragment:
                                                doc["content"] = content
                                                continue
                                            writer.add_document(
                                                id=f"{info.record_id}#{fragment}",
                                                type=type,
                                                content=content)
                                else:
                                    doc["content"] = (searcher.document(id=info.record_id) or {}).get("content", "")

                                writer.update_document(**doc)
                            elif props["type"] == "annotation":
                                created_date = datetime.fromisoformat(props["created"]).astimezone(timezone.utc)
                                updated_date = datetime.fromisoformat(props["updated"]).astimezone(timezone.utc)

                                writer.update_document(
                                    id=info.record_id,
                                    content=props["text"],
                                    type="annotation",
                                    group_s=props["group"],
                                    created_d=created_date,
                                    updated_d=updated_date,
                                    tag_s=props["tags"],
                                    reference_r=props.get("references", []),
                                    uri_s=[props["uri"]]+[link["href"] for link in props.get("document", {}).get("link", [])])

                        elif change_type == 'delete':
                            writer.delete_by_term("id", info.record_id)
                            writer.delete_by_query(Wildcard("id", f"{info.record_id}#*"))
                        else:
                            assert False, f'unknown change type {change_type}'

                    repo.update_indexed_commit(indexed_commit, head)

    def search(self, query, **kwargs):
        if isinstance(query, str):
            q = self.qp.parse(query)
        else:
            q = query

        with self.ix.searcher() as searcher:
            results = searcher.search(q, collapse="id", **kwargs)

            for hit in results:
                yield hit
