class Users:

    def __init__(self, repo, mkpasswd):
        self.repo = repo
        self.mkpasswd = mkpasswd

    def check_password(self, user_id, password, commit=None):
        repo = self.repo
        if commit is None:
            commit = repo.get_latest_commit()
        record_id = f"~{user_id}"
        info = repo.get_record_info(commit, record_id)
        if info is None:
            return
        crypted = info.props.get('password', None)
        if not crypted:
            return
        if self.mkpasswd(password, crypted) == crypted:
            return info

    def create(self, user_id, password, display_name, author=None, author_time=None):
        repo = self.repo
        while True:
            commit = repo.get_latest_commit()
            record_id = f"~{user_id}"
            if repo.get_record_info(commit, record_id) is not None:
                return False

            props = {
                "type": "file",
                "name": display_name,
                "password": self.mkpasswd(password),
            }

            if repo.put_record(commit, record_id, props, None, "Add user", author, author_time):
                return True

    def set_password(self, user_id, old_password, new_password, author=None, author_time=None):
        repo = self.repo
        while True:
            commit = repo.get_latest_commit()
            record_id = f"~{user_id}"
            info = self.check_password(user_id, old_password, commit)
            if info is None:
                return

            props = info.props

            props["password"] = self.mkpasswd(new_password)
            if repo.put_record(commit, record_id, props, None, "Change password", author, author_time):
                return True
