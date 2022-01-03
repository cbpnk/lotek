from datetime import datetime
from io import StringIO
from shutil import get_terminal_size
import sys

from pdfminer.pdfpage import PDFPage
from pdfminer.converter import TextConverter
from pdfminer.layout import LAParams
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.utils import decode_text
from pdfminer.psparser import PSLiteral
from pdfminer.pdftypes import PDFObjRef
from pdfminer.pdfparser import PDFParser
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdftypes import resolve1

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
    s = s.strip()
    if len(s) == 16:
        s += "+0000"
    if s.endswith("Z'"):
        s = s[:-2] + "+0000"
    elif s.endswith("Z"):
        s = s[:-1] + "+0000"
    elif s.endswith("'"):
        s += "00"
    s = s.replace("Z", "+")
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

    subject = metadata.pop("Subject", None)
    if subject:
        meta["subject_t"] = subject

    doi = metadata.pop("doi", None)
    if subject:
        meta["doi_s"] = doi

    keywords = metadata.pop("Keywords", None)
    if keywords:
        meta["keyword_s"] = [a.strip() for a in keywords.split(",")]
    creation_date = metadata.pop("CreationDate", None)
    if creation_date:
        meta["creation_d"] = parse_date(creation_date)

    mod_date = metadata.pop("ModDate", None)
    if mod_date:
        meta["mod_d"] = parse_date(mod_date)

    creator = metadata.pop("Creator", None)
    if creator:
        meta["creator_s"] = creator

    producer = metadata.pop("Producer", None)
    if producer:
        meta["producer_s"] = producer

    ptex_fullbanner = metadata.pop("PTEX.Fullbanner", None)
    if ptex_fullbanner:
        meta["PTEX.Fullbanner_t"] = ptex_fullbanner

    for k, v in metadata.items():
        print(f"{k}: {v}")

    return meta

def progress_bar(current, total, columns):
    tail = f'] {current}/{total}'
    length = columns - len(tail) - 1
    progress = int(current/total * length)
    print("\r[" + '=' * progress + ' ' * (length - progress) + tail, end="")

def extract_content(f):
    rsrcmgr = PDFResourceManager()
    laparams = LAParams()


    doc = PDFDocument(PDFParser(f))
    columns, _ = get_terminal_size((None, None))
    pages = resolve1(doc.catalog['Pages'])['Count']

    isatty = sys.stdout.isatty() if columns is not None else False
    for i, page in enumerate(PDFPage.create_pages(doc)):
        pagenum = i+1
        buf = StringIO()
        device = TextConverter(rsrcmgr, buf, laparams=laparams)
        interpreter = PDFPageInterpreter(rsrcmgr, device)
        interpreter.process_page(page)
        text = buf.getvalue().strip()

        if isatty:
            progress_bar(pagenum, pages, columns)

        if text:
            yield f"page={pagenum}", "page", text
