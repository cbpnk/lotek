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

        for (oldpath,newpath), (oldmode, newmode), (oldsha, newsha) in self.repo.object_store.tree_changes(old_tree, new_tree, change_type_same=True):
            yield newpath.decode(), self.repo[newsha].data.decode(), oldsha is None

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

    def _replace_content(self, old_tree, parts, content, mediafile):
        from dulwich.objects import Tree, Blob

        tree = Tree()
        if old_tree is not None:
            for name, mode, sha in old_tree.items():
                if name == parts[0]:
                    continue
                tree.add(name, mode, sha)
        if len(parts) == 1:
            blob = Blob.from_string(content)
            self.repo.object_store.add_object(blob)
            tree.add(parts[0], 0o100644, blob.id)
            if mediafile:
                blob = Blob.from_string(os.path.relpath(f".git/media/{mediafile}", os.path.dirname(mediafile)).encode())
                self.repo.object_store.add_object(blob)
                tree.add(os.path.basename(mediafile).encode(), 0o120000, blob.id)
        else:
            old_subtree = None
            if old_tree is not None and parts[0] in old_tree:
                mode, sha = old_tree[parts[0]]
                old_subtree = self.repo[sha]
            subtree = self._replace_content(old_subtree, parts[1:], content, mediafile)
            tree.add(parts[0], 0o040000, subtree.id)
        self.repo.object_store.add_object(tree)
        return tree

    def replace_content(self, commit, filename, content, message, author_time=None, mediafile=None):
        from dulwich.objects import Commit
        from dulwich.repo import get_user_identity
        import time
        filename = filename.encode()
        message = message.encode()

        old_tree = None
        if commit is not None:
            old_tree = self.repo[self.repo[commit].tree]
        tree = self._replace_content(old_tree, filename.split(b"/"), content, mediafile)

        config = self.repo.get_config()

        new_commit = Commit()
        new_commit.tree = tree.id
        new_commit.committer = get_user_identity(config, kind="COMMITTER")
        new_commit.commit_time = int(time.time())
        new_commit.commit_timezone = 0
        new_commit.author = get_user_identity(config, kind="AUTHOR")
        new_commit.author_time = int(author_time.timestamp() if author_time else time.time())
        new_commit.author_timezone = 0
        new_commit.encoding = b'UTF-8'
        new_commit.message = message
        new_commit.parents = [commit] if commit else []

        self.repo.object_store.add_object(new_commit)
        head = self.repo.refs.get_symrefs()[b'HEAD']
        if self.repo.refs.set_if_equals(head, commit, new_commit.id):
            return new_commit.id


    def import_file(self, filename, source_filename, mode):
        from shutil import copyfile
        basedir = self.repo.controldir()

        fullname = os.path.join(basedir, 'media', filename)
        dirname = os.path.dirname(fullname)
        os.makedirs(dirname, exist_ok=True)

        if os.path.exists(fullname):
            return

        if mode == 'copy':
            copyfile(source_filename, fullname)
        elif mode == 'link':
            os.link(source_filename, fullname)
        elif mode == 'move':
            os.rename(source_filename, fullname)
        else:
            assert False, f"unknown mode {mode}"

        os.chmod(fullname, 0o444)
