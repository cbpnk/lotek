import os
from pdfminer.utils import PDFDocEncoding
from pdfminer.psparser import PSLiteral
from pdfminer.pdfparser import PDFParser
from pdfminer.pdfdocument import PDFDocument

def decode(s):
    if isinstance(s, PSLiteral):
        s = s.name

    if isinstance(s, bytes) and s.startswith(b'\xfe\xff'):
        return s[2:].decode('utf-16be')
    else:
        if isinstance(s, str):
            s = [ord(c) for c in s]

        return "".join(PDFDocEncoding[c] for c in s)


def hash_file(filename, name='sha256'):
    import hashlib
    h = hashlib.new(name)
    with open(filename, 'rb') as f:
        while True:
            data = f.read(65536)
            if not data:
                break
            h.update(data)

        return h.hexdigest()


def run_import(source_filename, mode):
    from .config import config
    from .index import run_indexer
    ext = os.path.splitext(source_filename)[1]

    hexdigest = hash_file(source_filename)
    filename = f'{hexdigest[0:3]}/{hexdigest[3:6]}/{hexdigest[6:]}{ext}'
    mdname = f'{hexdigest[0:3]}/{hexdigest[3:6]}/{hexdigest[6:]}.md'

    repo = config.repo

    repo.import_file(filename, source_filename, mode)

    assert ext == ".pdf"

    metadata = {}
    with open(source_filename, 'rb') as f:
        doc = PDFDocument(PDFParser(f))
        for info in doc.info:
            for k, v in info.items():
                metadata[k] = decode(v)

    meta = {"category_i": ["pdf"]}
    author = metadata.pop("Author", None)
    if author:
        meta["author_t"] = [a.strip() for a in author.split(",")]
    title = metadata.pop("Title", None)
    if title:
        meta["title_t"] = title
    keywords = metadata.pop("Keywords", None)
    if keywords:
        meta["keyword_t"] = [a.strip() for a in keywords.split(",")]

    for k, v in metadata.items():
        print(f"{k}: {v}")

    while True:
        commit = repo.get_latest_commit()
        if commit:
            if repo.get_object(commit, filename):
                return

        content = config.parser.encode(meta, '')

        if repo.replace_content(commit, mdname, content, f"Import {filename}", mediafile=filename):
            run_indexer()
            break

    print(mdname)