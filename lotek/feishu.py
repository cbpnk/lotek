from urllib.request import urlopen, Request
from urllib.parse import unquote
from functools import reduce
import json
import re

TABLE = str.maketrans(
    {c: "\\" + c for c in "\\`*_{}[]()#+-.!~|^:"}
)

INDENT = ' ' * 4

def escape(text):
    return text.translate(TABLE)

def escape_code(code):
    n = reduce(max, map(len, re.findall(r'`+', code)), 0) + 1
    if code.startswith("`"):
        code = ' ' + code
    if code.endswith("`"):
        code = code + ' '
    return n, code

def to_rgba(color):
    if color is None:
        return
    return f"rgba({color['red']}, {color['green']}, {color['blue']}, {color['alpha']})"

def code_blocks_to_markdown(blocks):
    for block in blocks or []:
        if block["type"] == "paragraph":
            paragraph = block["paragraph"]
            yield INDENT
            for elem in paragraph["elements"]:
                if elem["type"] == 'textRun':
                    textRun = elem["textRun"]
                    yield textRun['text']
            yield '\n'

def table_cell_to_markdown(blocks, editor_url):
    for block in blocks or []:
        if block["type"] == "paragraph":
            paragraph = block["paragraph"]
            yield from rich_elements_to_markdown(paragraph["elements"], editor_url)

def callout_blocks_to_markdown(blocks, editor_url):
    prev_list_type = None
    for block in blocks or []:
        if block["type"] == "paragraph":
            paragraph = block["paragraph"]
            yield from paragraph_style_to_markdown(prev_list_type, paragraph.get('style', {}), indent=4)
            prev_list_type = paragraph.get('style', {}).get('list', {}).get('type', None)
            yield from rich_elements_to_markdown(paragraph["elements"], editor_url)
            yield '\n'


def find_first_hit(doc_token):
    from .config import config
    from whoosh.query import Term
    if doc_token:
        for hit in config.index.search(Term("feishu_token_i", doc_token)):
            return hit['path']

def build_wiki_link(doc_url, editor_url):
    if doc_url.startswith(editor_url + "/docs/"):
        hit = find_first_hit(doc_url[len(editor_url)+6:])
        if hit:
            yield '[['
            yield hit
            yield ']]'
            return

    yield '<'
    yield doc_url
    yield '>'

def rich_elements_to_markdown(elements, editor_url):
    for elem in elements:
        if elem["type"] == "textRun":
            textRun = elem["textRun"]
            style = textRun["style"]
            link = style.get("link", None)
            if style.get("bold", False):
                yield "*"
                yield escape(textRun['text'])
                yield "*"
            elif style.get("itatic", False):
                yield "**"
                yield escape(textRun['text'])
                yield "**"
            elif style.get("strikeThrough", False):
                yield "~~"
                yield escape(textRun['text'])
                yield "~~"
            elif style.get("underline", False):
                yield "^^"
                yield escape(textRun['text'])
                yield "^^"
            elif style.get("codeInline", False):
                n, code = escape_code(textRun['text'])
                yield "`" * n
                yield code
                yield "`" * n
            elif link is not None:
                yield '['
                yield escape(textRun['text'])
                yield ']('
                yield unquote(link["url"])
                yield ')'
            else:
                yield escape(textRun['text'])
        elif elem["type"] == "docsLink":
            docsLink = elem["docsLink"]
            doc_url = docsLink["url"]
            yield from build_wiki_link(doc_url, editor_url)
        elif elem["type"] == "equation":
            equation = elem["equation"]
            yield '$'
            yield equation["equation"]
            yield '$'

def paragraph_style_to_markdown(prev_list_type, style, indent=0):
    h = style.get("headingLevel", None)
    list = style.get("list", None)

    if list is not None:
        if prev_list_type != list["type"]:
            yield '\n'
        yield ' '*indent
        yield INDENT * (list['indentLevel'] - 1)
        if list["type"] == 'number':
            yield '1. '
        elif list["type"] == 'bullet':
            yield '* '
        elif list["type"] == "checkBox":
            yield '- [ ] '
        elif list["type"] == "checkedBox":
            yield '- [X] '
    else:
        yield '\n'
        yield ' '*indent
        if h is not None:
            yield '#' * h
            yield ' '
        elif style.get("quote", False):
            yield '> '

def to_markdown(content, editor_url):
    prev_list_type = None
    for block in content["body"]["blocks"]:
        if block["type"] == "paragraph":
            paragraph = block["paragraph"]
            yield from paragraph_style_to_markdown(prev_list_type, paragraph.get('style', {}))
            prev_list_type = paragraph.get('style', {}).get('list', {}).get('type', None)
            yield from rich_elements_to_markdown(paragraph["elements"], editor_url)
            yield '\n'
            continue
        elif block["type"] == "horizontalLine":
            yield '\n-----\n'
        elif block["type"] == "code":
            code = block["code"]
            yield '\n    :::'
            yield code["language"].lower()
            yield '\n'
            yield from code_blocks_to_markdown(code["body"]["blocks"])
        elif block["type"] == "callout":
            callout = block["callout"]
            background_color = to_rgba(callout.get("calloutBackgroundColor"))
            border_color = to_rgba(callout.get("calloutBorderColor"))
            text_color = to_rgba(callout.get("calloutTextColor"))
            style = ''
            if background_color:
                style += f'background:{background_color};'
            if border_color:
                style += f'border:1px solid {border_color};'
            if text_color:
                style += f'color:{text_color};'
            zoneid = callout['zoneId']
            if style:
                yield f'<style>.{zoneid} {{ {style} }}</style>\n'
            yield f'\n!!! callout {zoneid} ":'
            yield callout["calloutEmojiId"]
            yield ':"'

            yield from callout_blocks_to_markdown(callout["body"]["blocks"], editor_url)

        elif block["type"] == "table":
            table = block["table"]
            yield '\n| '
            yield ' | '.join(
                ''.join(table_cell_to_markdown(cell["body"]["blocks"], editor_url))
                for cell in table["tableRows"][0]["tableCells"])
            yield ' |\n| '
            yield ' | '.join('-' * table["columnSize"])
            yield ' |\n'

            for row in table["tableRows"][1:]:
                yield '| '
                yield ' | '.join(
                    ''.join(table_cell_to_markdown(cell["body"]["blocks"], editor_url))
                    for cell in row["tableCells"])
                yield ' |\n'

            if table["rowSize"] == 1:
                yield '| '
                yield ' | '.join(' ' * table["columnSize"])
                yield ' |\n'

        prev_list_type = None


class FeishuTenant:

    def __init__(self, config):
        self.url = config.FEISHU_URL
        self.app_id = config.FEISHU_APP_ID
        self.app_secret = config.FEISHU_APP_SECRET
        self.folder_token = config.FEISHU_FOLDER_TOKEN
        self.tenant_access_token = self._get_tenant_access_token()

    def _get_tenant_access_token(self):
        response = urlopen(
            Request(
                url="https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/",
                method="POST",
                data=json.dumps({"app_id": self.app_id, "app_secret": self.app_secret}).encode(),
                headers={"Content-Type": "application/json; charset=utf-8"}))
        return json.load(response)["tenant_access_token"]

    def create_new_file(self, filename, metadata):
        body = {"FolderToken": self.folder_token}
        title = metadata.get("title_t", [None])[0]
        if title:
            body["Content"] = json.dumps({
                "title": {
                    "elements": [{
                        "type": "textRun",
                        "textRun": {
                            "text": title,
                            "style": {}
                        }
                    }]
                }
            })

        response = urlopen(
            Request(
            url="https://open.feishu.cn/open-apis/doc/v2/create",
                method="POST",
                data=json.dumps(body).encode(),
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
        metadata.update({"feishu_token_i": [token], "revision_n": ["0"]})
        return metadata


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
        parts = list(to_markdown(content, self.url))
        metadata["content"] = ''.join(parts[1:]) if parts else ''
        return metadata
