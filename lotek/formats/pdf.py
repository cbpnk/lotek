from datetime import datetime
from io import StringIO

from pdfminer.pdfpage import PDFPage
from pdfminer.converter import TextConverter
from pdfminer.layout import LAParams
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.utils import decode_text
from pdfminer.psparser import PSLiteral
from pdfminer.pdftypes import PDFObjRef
from pdfminer.pdfparser import PDFParser
from pdfminer.pdfdocument import PDFDocument

NAME = 'Portable Document Format'

def decode(s):
    if isinstance(s, PDFObjRef):
        s = s.resolve()

    if isinstance(s, list):
        return list(map(decode, s))

    if isinstance(s, PSLiteral):
        s = s.name

    if isinstance(s, str):
        s = s.encode()

    return decode_text(s)


def parse_date(s):
    return datetime.strptime(s.replace("'", ""), "D:%Y%m%d%H%M%S%z")


def extract_metadata(f):
    metadata = {}
    doc = PDFDocument(PDFParser(f))
    for info in doc.info:
        for k, v in info.items():
            metadata[k] = decode(v)

    meta = {}
    author = metadata.pop("Author", None)
    if author:
        meta["author_t"] = [a.strip() for a in author.split(",")]
    title = metadata.pop("Title", None)
    if title:
        meta["title_t"] = title
    keywords = metadata.pop("Keywords", None)
    if keywords:
        meta["keyword_s"] = [a.strip() for a in keywords.split(",")]
    creation_date = metadata.pop("CreationDate", None)
    if creation_date:
        meta["creation_d"] = parse_date(creation_date)

    mod_date = metadata.pop("ModDate", None)
    if mod_date:
        meta["mod_d"] = parse_date(mod_date)

    for k, v in metadata.items():
        print(f"{k}: {v}")

    return meta

def extract_content(f):
    rsrcmgr = PDFResourceManager()
    laparams = LAParams()

    for i, page in enumerate(PDFPage.get_pages(f)):
        pagenum = i+1
        buf = StringIO()
        device = TextConverter(rsrcmgr, buf, laparams=laparams)
        interpreter = PDFPageInterpreter(rsrcmgr, device)
        interpreter.process_page(page)
        text = buf.getvalue().strip()

        yield f"page={pagenum}", "page", text
