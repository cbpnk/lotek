import os

class GitRepo:

    def __init__(self, config):
        from dulwich.repo import Repo
        from dulwich.errors import NotGitRepository

        path = config.REPO_ROOT

        try:
            repo = Repo(path)
        except NotGitRepository:
            repo = Repo.init_bare(path, mkdir=True)
        self.repo = repo

    def get_commit(self, head):
        if head in self.repo.refs:
            return self.repo.refs[head]

    def get_latest_commit(self):
        return self.get_commit(self.repo.refs.get_symrefs()[b'HEAD'])

    def get_indexed_commit(self):
        return self.get_commit(b'refs/heads/indexed')

    def update_indexed_commit(self, old_commit, new_commit):
        return self.repo.refs.set_if_equals(b'refs/heads/indexed', old_commit, new_commit)

    def diff_commit(self, old_commit, new_commit):
        if old_commit is None:
            old_tree = None
        else:
            old_tree = self.repo[old_commit].tree

        new_tree = self.repo[new_commit].tree

        for (oldpath, newpath), (oldmode, newmode), (oldsha, newsha) in self.repo.object_store.tree_changes(old_tree, new_tree):
            yield newpath.decode(), self.repo[newsha].data.decode(), oldsha is None

    def changes(self):
        for entry in self.repo.get_walker(max_entries=50):
            commit = entry.commit.id
            parent = (entry.commit.parents or [None])[0]
            old_tree = self.repo[parent].tree if parent else None
            new_tree = entry.commit.tree

            changes = [
                {"type": change.type, "path": change.new.path.decode()}
                for change in entry.changes()]

            yield {
                "author": entry.commit.author.decode(),
                "time": entry.commit.author_time,
                "changes": changes,
                "message": entry.commit.message.decode()
            }


    def get_object(self, commit, filename):
        from dulwich.objects import Tree
        from dulwich.errors import NotTreeError

        filename = filename.encode()

        if commit is not None:
            sha = self.repo[commit].tree

            for part in filename.split(b"/"):
                tree = self.repo[sha]
                if not isinstance(tree, Tree):
                    raise NotTreeError()
                if part not in tree:
                    return
                _, sha = tree[part]
            return sha

    def get_data(self, obj):
        return self.repo[obj].data

    def replace_content(self, commit, filename, content, message, author=None, author_time=None, mediafile=None):
        from dulwich.objects import Commit, Blob
        from dulwich.repo import get_user_identity
        from dulwich.object_store import commit_tree_changes
        import time
        filename = filename.encode()
        message = message.encode()

        old_tree = None
        if commit is not None:
            old_tree = self.repo[self.repo[commit].tree]

        blob = Blob.from_string(content)
        self.repo.object_store.add_object(blob)
        changes = [(filename, 0o100644, blob.id)]
        if mediafile:
            blob = Blob.from_string(os.path.relpath(f".git/media/{mediafile}", os.path.dirname(mediafile)).encode())
            self.repo.object_store.add_object(blob)
            changes.append((mediafile.encode(), 0o120000, blob.id))
        tree = commit_tree_changes(self.repo.object_store, old_tree, changes)
        config = self.repo.get_config()

        new_commit = Commit()
        new_commit.tree = tree.id
        new_commit.committer = get_user_identity(config, kind="COMMITTER")
        new_commit.commit_time = int(time.time())
        new_commit.commit_timezone = 0
        new_commit.author = author.encode() if author else get_user_identity(config, kind="AUTHOR")
        new_commit.author_time = int(author_time.timestamp() if author_time else time.time())
        new_commit.author_timezone = 0
        new_commit.encoding = b'UTF-8'
        new_commit.message = message
        new_commit.parents = [commit] if commit else []

        self.repo.object_store.add_object(new_commit)
        head = self.repo.refs.get_symrefs()[b'HEAD']
        if self.repo.refs.set_if_equals(head, commit, new_commit.id):
            return new_commit.id


    def import_file(self, filename, source, mode=None):
        from shutil import copyfile, copyfileobj
        fullname = self.file_path(filename)
        dirname = os.path.dirname(fullname)
        os.makedirs(dirname, exist_ok=True)

        if os.path.exists(fullname):
            return

        if mode == 'copy':
            copyfile(source, fullname)
        elif mode == 'link':
            os.link(source, fullname)
        elif mode == 'move':
            os.rename(source, fullname)
        elif mode is not None:
            assert False, f"unknown mode {mode}"
        else:
            try:
                f = open(fullname, 'xb')
            except FileExistsError:
                pass
            with f:
                copyfileobj(source, f)

        os.chmod(fullname, 0o444)

    def open_file(self, filename):
        return open(self.file_path(filename), 'rb')

    def file_path(self, filename):
        basedir = self.repo.controldir()
        return os.path.join(basedir, 'media', filename)
