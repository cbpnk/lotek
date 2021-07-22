import re
from whoosh.fields import TEXT
from whoosh.analysis import StandardAnalyzer, Filter, NgramFilter
from whoosh.query import And, Or, Term, Wildcard, SpanNear2

NGRAM = NgramFilter(2)
CJK = re.compile(r'[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\U0001F200-\U0001F2FF\U00020000-\U0002FA1F]+')

def split_cjk(t):
    index = 0
    startchar = None
    endchar = None
    if t.chars:
        startchar = t.startchar
        endchar = t.endchar

    for m in CJK.finditer(t.text):
        prev = t.text[index:m.start()]
        if prev:
            t.text = prev
            if t.chars:
                t.startchar = startchar + index
                t.endchar = startchar + m.start()
            yield t, False

        t.text = m.group()
        if t.chars:
            t.startchar = startchar + m.start()
            t.endchar = startchar + m.end()
        yield t, True
        index = m.end()

    last = t.text[index:]
    if last:
        t.text = last
        if t.chars:
            t.startchar = startchar + index
            t.endchar = endchar
        yield t, False


def ngram_cjk(t):
    for t, is_cjk in split_cjk(t):
        if is_cjk and len(t.text) != 1:
            for t in NGRAM([t]):
                yield t, True
        else:
            yield t, is_cjk


class CJKFilter(Filter):

    def __call__(self, tokens):
        last_origin_pos = -1
        next_pos = 0

        for t in tokens:
            if t.mode == 'index':
                next_pos += t.pos - last_origin_pos - 1
                last_origin_pos = t.pos
                for t, is_cjk in ngram_cjk(t):
                    t.pos = next_pos
                    next_pos += 1
                    yield t
                if is_cjk:
                    next_pos += 1
            elif t.mode == 'query':
                yield t

def text2term(fieldname, text, is_cjk):
    if is_cjk and len(text) == 1:
        return Wildcard(fieldname, f"*{text}*")
    return Term(fieldname, text)

class SpanNear3(SpanNear2):
    def _and_query(self):
        return And(self.qs)

def token2term(fieldname, t):
    terms = [text2term(fieldname, t.text, is_cjk) for t, is_cjk in ngram_cjk(t)]
    if len(terms) == 1:
        return terms[0]
    return SpanNear3(terms)


class NGRAMCJKTEXT(TEXT):

    def __init__(self, analyzer=None, **kwargs):
        analyzer = analyzer or StandardAnalyzer(minsize=1)
        super().__init__(analyzer=analyzer, **kwargs)
        self.analyzer |= CJKFilter()

    def self_parsing(self):
        return True

    def parse_query(self, fieldname, qstring, boost=1.0):
        terms = [token2term(fieldname, t) for t in self.analyzer(qstring, mode='query')]
        if len(terms) == 1:
            terms[0].boost = boost
            return terms[0]
        cls = Or if self.queryor else And
        return cls(terms, boost=boost)
