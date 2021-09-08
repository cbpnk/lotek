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
    basename, ext = os.path.splitext(source_filename)
    hexdigest = hash_file(f)
    filename = f'{hexdigest}{ext}'
    txtname = f'{hexdigest}.txt'

    repo = config.repo
    f.seek(0)
    repo.import_file(filename, source_filename if mode else f, mode)

    f.seek(0)

    mod = config.media_formats.get(ext, None)
    assert mod, f"{ext} file not supported"
    meta = mod.extract_metadata(f)
    if "title_t" not in meta:
        meta["title_t"] = [os.path.basename(basename) if mode else basename]
    create_new_txt(txtname, meta, f"Import {filename}", mediafile=filename, **kwargs)
    return txtname


def run_import(source_filename, mode):
    from .index import run_indexer
    with open(source_filename, 'rb') as f:
        print(import_file(source_filename, f, mode))
    run_indexer()

def index_file(path, add_document):
    from .config import config
    basename, ext = os.path.splitext(path)

    mod = config.media_formats.get(ext, None)
    assert mod, f"{ext} file not supported"
    mod.index_file(path, add_document)
