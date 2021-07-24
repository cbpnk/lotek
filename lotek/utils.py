import os

def create_new_txt(filename, metadata, message=None, author=None, **kwargs):
    from .config import config
    from .index import run_indexer
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

    if filename.endswith(".txt"):
        meta = config.editor.create_new_file(filename, metadata)
        if meta:
            while True:
                commit = repo.get_latest_commit()
                if repo.replace_content(commit, filename, parser.format(meta), f"Setup: {filename}"):
                    break

    run_indexer()
    return True

def decode(s):
    from pdfminer.utils import PDFDocEncoding
    from pdfminer.psparser import PSLiteral

    if isinstance(s, PSLiteral):
        s = s.name

    if isinstance(s, bytes) and s.startswith(b'\xfe\xff'):
        return s[2:].decode('utf-16be')
    else:
        if isinstance(s, str):
            s = [ord(c) for c in s]

        return "".join(PDFDocEncoding[c] for c in s)


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

    ext = os.path.splitext(source_filename)[1]
    hexdigest = hash_file(f)
    filename = f'{hexdigest[0:3]}/{hexdigest[3:6]}/{hexdigest[6:]}{ext}'

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
    title = metadata.pop("Title", os.path.basename(source_filename) if mode else source_filename)
    if title:
        meta["title_t"] = [title]
    keywords = metadata.pop("Keywords", None)
    if keywords:
        meta["keyword_t"] = [a.strip() for a in keywords.split(",")]

    for k, v in metadata.items():
        print(f"{k}: {v}")

    create_new_txt(filename, meta, f"Import {filename}", **kwargs)
    return filename


def run_import(source_filename, mode):
    with open(source_filename, 'rb') as f:
        print(import_file(source_filename, f, mode))
