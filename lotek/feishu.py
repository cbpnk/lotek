from urllib.request import urlopen, Request
import json

def to_markdown(content):
    for block in content["body"]["blocks"]:
        if block["type"] == "paragraph":
            paragraph = block["paragraph"]
            style = paragraph.get('style', {})
            h = style.get("headingLevel", None)
            if h is not None:
                yield '#' * h
                yield ' '
            list = style.get("list", None)
            if list is not None:
                if list["type"] == 'number':
                    yield '1. '
                elif list["type"] == 'bullet':
                    yield '* '
                elif list["type"] == "checkBox":
                    yield '- [ ] '
                elif list["type"] == "checkedBox":
                    yield '- [X] '

            quote = style.get("quote", False)
            if quote:
                yield '> '

            for elem in paragraph["elements"]:
                if elem["type"] == "textRun":
                    textRun = elem["textRun"]
                    style = textRun["style"]
                    if style.get("bold", False):
                        yield f"*{textRun['text']}*"
                    elif style.get("itatic", False):
                        yield f"**{textRun['text']}**"
                    else:
                        yield textRun['text']

            yield '\n\n'



class FeishuTenant:

    def __init__(self, config):
        self.url = config.EDITOR_URL
        self.app_id = config.FEISHU_APP_ID
        self.app_secret = config.FEISHU_APP_SECRET
        self.tenant_access_token = self._get_tenant_access_token()

    def _get_tenant_access_token(self):
        response = urlopen(
            Request(
                url="https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/",
                method="POST",
                data=json.dumps({"app_id": self.app_id, "app_secret": self.app_secret}).encode(),
                headers={"Content-Type": "application/json; charset=utf-8"}))
        return json.load(response)["tenant_access_token"]

    def create_new_file(self, filename):
        response = urlopen(
            Request(
            url="https://open.feishu.cn/open-apis/doc/v2/create",
                method="POST",
                data=json.dumps({}).encode(),
                headers={
                    "Authorization": f"Bearer {self.tenant_access_token}",
                "Content-Type": "application/json; charset=utf-8"}
            ))
        result = json.load(response)
        assert result['code'] == 0

        token = result["data"]["objToken"]

        response = urlopen(
            Request(
                method="POST",
                url="https://open.feishu.cn/open-apis/drive/permission/v2/public/update/",
                headers={
                    "Content-Type": "application/json; charset=utf-8",
                    "Authorization": f"Bearer {self.tenant_access_token}"},
                data=json.dumps({"token": token, "type": "doc", "link_share_entity": "tenant_editable"}).encode()))
        result = json.load(response)
        assert result['code'] == 0
        return {"feishu_token_i": [result["data"]["objToken"]],
                "revision_n": ["0"]}

    def get_new_content(self, filename, metadata):
        token = metadata["feishu_token_i"][0]
        response = urlopen(
            Request(
                url=f"https://open.feishu.cn/open-apis/doc/v2/{token}/content",
                headers={
                    "Authorization": f"Bearer {self.tenant_access_token}",
                    "Content-Type": "application/json; charset=utf-8"}
            ))
        result = json.load(response)
        assert result['code'] == 0

        if int(metadata.get("revision_n", ["0"])[0]) >= result['data']['revision']:
            return

        content = json.loads(result['data']['content'])
        title = ''.join(elem['textRun']['text'] for elem in content["title"]["elements"])
        metadata["revision_n"] = [str(result['data']['revision'])]
        metadata["title_t"] = [title]
        metadata["content"] = ''.join(to_markdown(content))
        return metadata
