import os
from io import BytesIO
from contextlib import nullcontext


def create_new_file(repo, formats, record_id, props, author=None, date=None):
    ext = props.get("ext", None)
    if not ext:
        return

    file_format = getattr(formats, ext)

    f = BytesIO()
    file_format.init_new_file(f)
    data = f.getvalue()
    meta = file_format.extract_metadata(f)
    props["meta"] = meta

    content = (ext, 0o100644, data)
    props["size"] = len(data)

    title = meta.get("title_t", None)
    if title:
        props["name"] = title
    props["type"] = "file"

    while True:
        commit = repo.get_latest_commit()
        if repo.get_record_info(commit, record_id):
            return False

        if repo.put_record(commit, record_id, props, content, f"Create {ext} file", author, date):
            return True



def import_file(repo, formats, source_filename, source=None, mode=None, author=None, date=None):
    basename, ext = os.path.splitext(os.path.basename(source_filename))
    props = {
        "type": "file",
        "name": basename,
    }

    ext = ext[1:]
    file_format = None
    if ext:
        props["ext"] = ext
        file_format = getattr(formats, ext, None)

    if source is None:
        source = open(source_filename, 'rb')
        cm = source
    else:
        cm = nullcontext()

    with cm:
        record_id, size, content = repo.import_media_file(ext, source, mode)
        props["size"] = size

        while True:
            commit = repo.get_latest_commit()
            if repo.get_record_info(commit, record_id):
                return record_id, False

            message = f"Import .{ext} file" if ext else f"Import file"

            if "meta" not in props and file_format:
                meta = file_format.extract_metadata(source)
                props["meta"] = meta
                title = meta.get("title_t", None)
                if title:
                    props["name"] = title
                    message += f" {title}"

            if repo.put_record(commit, record_id, props, content, message, author, date):
                return record_id, True
