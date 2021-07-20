import re
from whoosh.fields import TEXT
from whoosh.analysis import StandardAnalyzer, Filter, NgramTokenizer
from whoosh.query import And, Or, Term, Wildcard, SpanNear2

NGRAM = NgramTokenizer(2)
CJK = re.compile(r'[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\U0001F200-\U0001F2FF\U00020000-\U0002FA1F]+')

def split_cjk(text):
    index = 0

    for m in CJK.finditer(text):
        prev = text[index:m.start()]
        if prev:
            yield prev, False
        yield m.group(), True
        index = m.end()

    last = text[index:]
    if last:
        yield last, False

def ngram_cjk(text):
    for text, is_cjk in split_cjk(text):
        if is_cjk and len(text) != 1:
            for t in NGRAM(text):
                yield t.text, True
        else:
            yield text, is_cjk

class CJKFilter(Filter):

    def __call__(self, tokens):
        last_origin_pos = -1
        next_pos = 0

        for t in tokens:
            assert not t.chars
            if t.mode == 'index':
                next_pos += t.pos - last_origin_pos - 1
                last_origin_pos = t.pos

                for text, is_cjk in ngram_cjk(t.text):
                    t.text = text
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
    terms = [text2term(fieldname, text, is_cjk) for text, is_cjk in ngram_cjk(t.text)]
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
