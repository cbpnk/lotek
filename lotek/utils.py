import os

def create_new_txt(filename, metadata, message=None, author=None, **kwargs):
    from .config import config
    repo = config.repo
    parser = config.parser

    message = message or f"Create {filename}"

    while True:
        commit = repo.get_latest_commit()
        if commit:
            if repo.get_object(commit, filename):
                return False

        if repo.replace_content(commit, filename, parser.format(metadata), message, author, **kwargs):
            break

    meta = config.editor.create_new_file(filename, metadata)
    if meta:
        while True:
            commit = repo.get_latest_commit()
            if repo.replace_content(commit, filename, parser.format(meta), f"Setup: {filename}"):
                break

    return True

def decode(s):
    from pdfminer.utils import decode_text
    from pdfminer.psparser import PSLiteral
    from pdfminer.pdftypes import PDFObjRef


    if isinstance(s, PDFObjRef):
        s = s.resolve()

    if isinstance(s, list):
        return list(map(decode, s))

    if isinstance(s, PSLiteral):
        s = s.name

    if isinstance(s, str):
        s = s.encode()

    return decode_text(s)


def hash_file(f, name='sha256'):
    import hashlib
    h = hashlib.new(name)
    while True:
        data = f.read(65536)
        if not data:
            break
        h.update(data)
    return h.hexdigest()

def import_file(source_filename, f, mode=None, **kwargs):
    from .config import config
    from pdfminer.pdfparser import PDFParser
    from pdfminer.pdfdocument import PDFDocument

    basename, ext = os.path.splitext(source_filename)
    hexdigest = hash_file(f)
    filename = f'{hexdigest[0:3]}/{hexdigest[3:6]}/{hexdigest[6:]}{ext}'
    txtname = f'{hexdigest[0:3]}/{hexdigest[3:6]}/{hexdigest[6:]}.txt'

    repo = config.repo
    f.seek(0)
    repo.import_file(filename, source_filename if mode else f, mode)

    assert ext == ".pdf"

    metadata = {}
    f.seek(0)
    doc = PDFDocument(PDFParser(f))
    for info in doc.info:
        for k, v in info.items():
            metadata[k] = decode(v)

    meta = {"category_i": ["pdf"]}
    author = metadata.pop("Author", None)
    if author:
        meta["author_t"] = [a.strip() for a in author.split(",")]
    title = metadata.pop("Title", None) or os.path.basename(basename) if mode else basename
    if title:
        meta["title_t"] = [title]
    keywords = metadata.pop("Keywords", None)
    if keywords:
        meta["keyword_t"] = [a.strip() for a in keywords.split(",")]

    for k, v in metadata.items():
        print(f"{k}: {v}")

    create_new_txt(txtname, meta, f"Import {filename}", mediafile=filename, **kwargs)
    return txtname


def run_import(source_filename, mode):
    from .index import run_indexer
    with open(source_filename, 'rb') as f:
        print(import_file(source_filename, f, mode))
    run_indexer()

def index_file(path, add_document):
    from .config import config
    from io import StringIO
    from pdfminer.pdfpage import PDFPage
    from pdfminer.converter import TextConverter
    from pdfminer.layout import LAParams
    from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter


    if not path.endswith(".pdf"):
        return

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
