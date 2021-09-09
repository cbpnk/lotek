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
from .config import config

EXT = ".pdf"


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


def extract_metadata(f):
    metadata = {}
    doc = PDFDocument(PDFParser(f))
    for info in doc.info:
        for k, v in info.items():
            metadata[k] = decode(v)

    meta = {"category_i": ["pdf"]}
    author = metadata.pop("Author", None)
    if author:
        meta["pdf__author_t"] = [a.strip() for a in author.split(",")]
    title = metadata.pop("Title", None)
    if title:
        meta["title_t"] = [title]
    keywords = metadata.pop("Keywords", None)
    if keywords:
        meta["pdf__keyword_t"] = [a.strip() for a in keywords.split(",")]

    for k, v in metadata.items():
        print(f"{k}: {v}")

    return meta


def index_file(path, add_document):
    rsrcmgr = PDFResourceManager()
    laparams = LAParams()

    with config.repo.open_file(path) as f:
        for i, page in enumerate(PDFPage.get_pages(f)):
            pagenum = i+1

            buf = StringIO()
            device = TextConverter(rsrcmgr, buf, laparams=laparams)
            interpreter = PDFPageInterpreter(rsrcmgr, device)
            interpreter.process_page(page)
            text = buf.getvalue().strip()

            if text:
                add_document(
                    path=f"{path}#page={pagenum}",
                    content=text,
                    category_i=["pdf-page"])
