import time
import os
from io import BytesIO
from stat import S_ISLNK
from shutil import copyfile, copyfileobj
import hashlib

from dulwich.repo import Repo
from dulwich.errors import NotGitRepository, NotTreeError
from dulwich.objects import Blob, Tree, Commit
from dulwich.object_store import tree_lookup_path, commit_tree_changes
from dulwich.repo import get_user_identity
from dulwich.diff_tree import tree_changes

from ..props import encode, decode


def split_record_id(record_id):
    if record_id.startswith("~"):
        yield "users"
        yield record_id[1:]
        return

    for i in range(2):
        if len(record_id) <= 3:
            break
        yield record_id[:3]
        record_id = record_id[3:]

    yield record_id + "."

def record_id_to_path(record_id):
    return "/".join(split_record_id(record_id))

def path_to_record_id(path):
    path = path.decode()
    if path.startswith("users/"):
        return "~"+path[6:]
    return path.replace("/", "")

def media_file_path(record_id, ext):
    path = record_id_to_path(record_id)
    if ext:
        return path + ext
    return path


def get_head(repo):
    return repo.refs.get_symrefs()[b'HEAD']

def do_commit(repo, parent, tree, message, author=None, author_time=None):
    config = repo.get_config()
    new_commit = Commit()
    new_commit.tree = tree.id
    new_commit.committer = get_user_identity(config, kind="COMMITTER")
    new_commit.commit_time = int(time.time())
    new_commit.commit_timezone = 0
    new_commit.author = author.encode() if author else get_user_identity(config, kind="AUTHOR")
    new_commit.author_time = int(author_time.timestamp() if author_time else time.time())
    new_commit.author_timezone = 0
    new_commit.encoding = b'UTF-8'
    new_commit.message = message.encode()
    new_commit.parents = [parent] if parent else []

    repo.object_store.add_object(new_commit)
    if repo.refs.set_if_equals(get_head(repo), parent, new_commit.id):
        return new_commit.id


class RecordInfo:

    def __init__(self, record_id, props_id, props, ext, mode, object_id):
        self.record_id = record_id
        self.props_id = props_id
        self.props = props
        self.ext = ext
        self.mode = mode
        self.object_id = object_id

    def islink(self):
        return S_ISLNK(self.mode)

    def etag(self):
        if self.object_id:
            return (self.props_id + b"-" + self.object_id).decode()
        return self.props_id.decode()

    def __repr__(self):
        return f'<RecordInfo record_id={self.record_id} props_id={self.props_id} ext={self.ext} mode={self.mode} object_id={self.object_id}>'


def hash_file(f, name='sha256'):
    h = hashlib.new(name)
    while True:
        data = f.read(65536)
        if not data:
            break
        h.update(data)
    return h.hexdigest()


class GitRepo:

    def __init__(self, path):
        try:
            repo = Repo(path)
        except NotGitRepository:
            repo = Repo.init_bare(path, mkdir=True)
        self.repo = repo

    def get_commit(self, head):
        if head in self.repo.refs:
            return self.repo.refs[head]

    def get_latest_commit(self):
        return self.get_commit(get_head(self.repo))

    def get_indexed_commit(self):
        return self.get_commit(b'refs/heads/indexed')

    def update_indexed_commit(self, old_commit, new_commit):
        return self.repo.refs.set_if_equals(b'refs/heads/indexed', old_commit, new_commit)

    def changes(self):
        for entry in self.repo.get_walker(max_entries=50):
            commit = entry.commit.id
            parent = (entry.commit.parents or [None])[0]
            old_tree = self.repo[parent].tree if parent else None
            new_tree = entry.commit.tree

            change_by_type = {
                'add': set(),
                'modify': set(),
                'delete': set(),
            }

            for change in entry.changes():
                change_by_type[change.type].add(
                    path_to_record_id(( change.new if change.type != 'delete' else change.old).path).split(".", 1)[0])

            yield {
                "author": entry.commit.author.decode(),
                "time": entry.commit.author_time,
                "changes": [ 
                    {"type": type,
                     "id": record_id}
                    for type, record_ids in change_by_type.items()
                    for record_id in record_ids
                ],
                "message": entry.commit.message.decode()
            }


    def commit_changes(self, old_commit, new_commit):
        repo = self.repo

        if old_commit is None:
            old_tree = None
        else:
            old_tree = repo[old_commit].tree

        new_tree = repo[new_commit].tree

        files = {}
        changes = []

        for change in tree_changes(
                repo.object_store,
                old_tree,
                new_tree,
                want_unchanged=False,
                include_trees=False,
                change_type_same=False,
                rename_detector=None):
            if change.type in ('add', 'modify'):
                record_id = path_to_record_id(change.new.path)
                record_id, ext = os.path.splitext(record_id)
                if not ext[1:]:
                    props = decode(repo[change.new.sha].data.decode())
                    ext = props.get('ext', "")
                    files[f"{record_id}.{ext}"] = (change.type, change.new.sha, props)
                else:
                    changes.append(change)
            elif change.type == 'delete':
                record_id = path_to_record_id(change.old.path)
                record_id, ext = os.path.splitext(record_id)
                if not ext[1:]:
                    props = decode(repo[change.old.sha].data.decode())
                    ext = props.get('ext', "")
                    files[f"{record_id}.{ext}"] = (change.type, change.old.sha, props)
                else:
                    changes.append(change)
            else:
                assert False, f"unsupported change type {change.type}"

        for change in changes:
            if change.type in ('add', 'modify'):
                record_id = path_to_record_id(change.new.path)
                change_type, sha, props = files.pop(record_id, (None, None, None))
                if change_type is None:
                    info = RecordInfo(record_id, None, None, None, change.new.mode, change.new.sha)
                    record_id, ext = os.path.splitext(record_id)
                    if ext[1:]:
                        new_info = self.get_record_info(new_commit, record_id)
                        yield (change.type, new_info or info)
                    else:
                        yield (change.type, info)
                else:
                    assert change.type == change_type
                    record_id, ext = os.path.splitext(record_id)
                    yield (change.type, RecordInfo(record_id, sha, props, ext[1:], change.new.mode, change.new.sha))
            else:
                record_id = path_to_record_id(change.old.path)
                record_id, ext = os.path.splitext(record_id)
                change_type, sha, props = files.pop(record_id, (None, None, None))
                if change_type is None:
                    yield (change.type, RecordInfo(record_id, None, None, None, change.old.mode, change.old.sha))
                else:
                    assert change.type == change_type
                    record_id, ext = os.path.splitext(record_id)
                    yield (change.type, RecordInfo(record_id, sha, props, ext[1:], change.old.mode, change.old.sha))

        for record_id, (change_type, sha, props) in files.items():
            if record_id.endswith("."):
                yield (change.type, RecordInfo(record_id[:-1], sha, props, None, None, None))
            else:
                record_id, ext = os.path.splitext(record_id)
                yield (change.type, RecordInfo(record_id, sha, props, None, None, None))


    def mtime(self, commit, record_id, ext):
        path = record_id_to_path(record_id) + ext
        walker = self.repo.get_walker(max_entries=1, paths=(path.encode(),))
        entry = next(iter(walker))
        return entry.commit.author_time

    def get_tree(self, commit):
        if commit is None:
            return Tree()

        repo = self.repo
        return repo[repo[commit].tree]

    def lookup_tree(self, commit, path):
        repo = self.repo
        tree = self.get_tree(commit)

        for p in path.split("/"):
            if not isinstance(tree, Tree):
                return
            mode, sha = tree._entries.get(p.encode(), (None, None))
            if not sha:
                return
            tree = repo[sha]

        return tree

    def get_record_info(self, commit, record_id):
        path = record_id_to_path(record_id)
        dirname, basename = os.path.split(path)
        repo = self.repo
        tree = self.lookup_tree(commit, dirname)
        if not tree:
            return

        mode, sha = tree._entries.get(basename.encode(), (None, None))
        if sha is None:
            return

        props_id = sha

        props = decode(repo[sha].data.decode())
        ext = props.get('ext', None)
        if ext:
            mode, sha = tree[(basename+ext).encode()]
        else:
            mode, sha = None, None

        return RecordInfo(record_id, props_id, props, ext, mode, sha)

    def put_record(self, commit, record_id, props, content, message, author=None, author_time=None):
        path = record_id_to_path(record_id)

        repo = self.repo
        object_store = repo.object_store

        tree = self.get_tree(commit)

        props = props or {}
        blob = Blob.from_string(encode(props))
        object_store.add_object(blob)
        changes = [(path.encode(), 0o100644, blob.id)]

        if content is not None:
            ext, mode, data = content
            props['ext'] = ext
            if S_ISLNK(mode):
                blob = Blob.from_string(os.path.relpath(os.path.join(".git/media", data), os.path.dirname(path)).encode())
            else:
                blob = Blob.from_string(data)
            object_store.add_object(blob)
            changes.append(((path + ext).encode(), mode, blob.id))

        new_tree = commit_tree_changes(object_store, tree, changes)
        return do_commit(repo, commit, new_tree, message, author, author_time)

    def delete_record(self, commit, record_id, message, author=None, author_time=None):
        path = record_id_to_path(record_id)
        repo = self.repo
        tree = self.get_tree(commit)
        changes = [(path.encode(), None, None)]
        new_tree = commit_tree_changes(repo.object_store, tree, changes)
        return do_commit(repo, commit, new_tree, message, author, author_time)

    def open(self, info):
        if info.islink():
            basedir = self.repo.controldir()
            return open(os.path.join(basedir, 'media', media_file_path(info.record_id, info.ext)), 'rb')
        else:
            return BytesIO(self.repo[info.object_id].data)

    def import_media_file(self, ext, source, mode='copy'):
        record_id = hash_file(source)
        size = source.tell()
        source.seek(0)

        path = media_file_path(record_id, ext)

        basedir = self.repo.controldir()
        fullpath = os.path.join(basedir, 'media', path)

        if os.path.exists(fullpath):
            return record_id, size, (ext, 0o120000, path)

        os.makedirs(os.path.dirname(fullpath), exist_ok=True)

        if mode == 'copy':
            copyfile(source.name, fullpath)
        elif mode == 'link':
            os.link(source.name, fullpath)
        elif mode == 'move':
            os.rename(source.name, fullpath)
        elif mode is not None:
            assert False, f"unknown mode {mode}"
        else:
            with open(fullpath, 'xb') as f:
                copyfileobj(source, f)

        os.chmod(fullpath, 0o444)
        return record_id, size, (ext, 0o120000, path)
