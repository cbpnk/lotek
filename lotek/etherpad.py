import os
import json
from urllib.request import urlopen, Request
from urllib.parse import urlencode
import re

def iter_op(attribs, numToAttrib):
    for m in re.finditer(r'((?:\*[0-9a-z]+)*)(?:\|([0-9a-z]+))?([-+=])([0-9a-z]+)|\?|', attribs):
        if m.group(0):
            yield {
                "opcode": m.group(3),
                "chars": int(m.group(4), 36),
                "lines": int(m.group(2) or '0', 36),
                "attribs": [numToAttrib[int(a, 36)] for a in m.group(1).split("*")[1:]]}

def get_attrib(attribs, name):
    for a in attribs:
        if a[0] == name:
            return a[1]

def get_heading(attribs):
    for a in attribs:
        if a[0] == 'heading':
            return a[1]

def get_bold(attribs):
    for a in attribs:
        if a[0] == 'bold':
            return a[1]

def get_list(attribs):
    for a in attribs:
        if a[0] == 'list':
            return a[1]

def to_markdown(ops, text):
    for op in ops:
        chars, text = text[:op["chars"]], text[op["chars"]:]
        heading = get_attrib(op['attribs'], 'heading')
        if heading and heading.startswith("h"):
            yield '#' * int(heading[1:]) + ' '
            continue

        if get_attrib(op['attribs'], 'bold') == 'true':
            yield '*'
            yield chars
            yield '*'
            continue

        list = get_attrib(op['attribs'], 'list')

        if list and list.startswith("bullet"):
            yield "    " * (int(list[6:]) - 1)
            yield "* "
            continue

        yield chars


class Etherpad:

    def __init__(self, config):
        self.url = config.EDITOR_URL
        filename = config.__file__
        APIKEY_PATH = os.path.join(os.path.dirname(filename) if filename else os.getcwd(), 'persistent/APIKEY.txt')
        with open(APIKEY_PATH, 'r') as f:
            APIKEY = f.read()
        self.apikey = os.environ.get('ETHERPAD_APIKEY', APIKEY)

    def _pad_id(self, filename):
        assert filename.endswith(b".md")
        return filename.decode()[:-3].replace("/", "-")

    def create_new_file(self, filename):
        pad_id = self._pad_id(filename)
        response = urlopen(Request(f"{self.url}/api/1/createPad?" + urlencode({"padID": pad_id, "text": "", "apikey": self.apikey}), method='POST'))
        print(response.read())
        return {"revision_n": ["0"]}

    def get_new_content(self, filename, metadata):
        pad_id = self._pad_id(filename)
        response = urlopen(f"{self.url}/p/{pad_id}/export/etherpad")
        pad = json.load(response)[f"pad:{pad_id}"]

        if int(metadata["revision_n"][0]) >= pad["head"]:
            return

        text = pad["atext"]["text"]
        attribs = pad["atext"]["attribs"]
        numToAttrib = [
            pad["pool"]["numToAttrib"][str(i)]
            for i in range(pad["pool"]["nextNum"]) ]

        metadata["revision_n"] = [str(pad["head"])]
        return metadata, ''.join(to_markdown(iter_op(attribs, numToAttrib), text))
