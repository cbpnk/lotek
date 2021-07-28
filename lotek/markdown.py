from markdown import Markdown
from markdown.extensions import Extension
from markdown.inlinepatterns import InlineProcessor
from markdown.treeprocessors import Treeprocessor
from markdown.util import etree, HTML_PLACEHOLDER_RE
from markdown.preprocessors import NormalizeWhitespace
from markdown.extensions.meta import MetaPreprocessor


def find_title(path):
    from .config import config
    from whoosh.query import Term
    for hit in config.index.search(Term("path", path)):
        return hit.get("title_t", [None])[0]

def build_link(target, text=None):
    if not text:
        text = find_title(target) or target
    return f"/view/{target}" , text

class WikiLinks(InlineProcessor):

    def handleMatch(self, m, data):
        target = m.group("target")
        text = m.group("text")
        text = text[1:] if text else None
        self.md.wikilinks.add(target)
        url, text = build_link(target, text)
        a = etree.Element('a')
        a.text = text
        a.set('href', url)
        return a, m.start(0), m.end(0)


class WikiLinkExtension(Extension):

    def extendMarkdown(self, md, md_globals):
        self.md = md
        self.md.wikilinks = set()
        WIKILINK_RE = r'\[\[(?P<target>[@\w/0-9:_ -\.]+)(?P<text>(?:\|[\w/0-9:_ -]+)?)\]\]'
        pattern = WikiLinks(WIKILINK_RE)
        pattern.md = md
        md.inlinePatterns.register(pattern, 'wikilink', 75)

    def reset(self):
        self.md.wikilinks = set()

class TasklistCollector(Treeprocessor):

    def run(self, root):
        for elem in root.findall(".//li[@class='task-list-item']"):
            checked = "checked" in self.md.htmlStash.rawHtmlBlocks[int(HTML_PLACEHOLDER_RE.search(elem.text).group(1))]
            text = HTML_PLACEHOLDER_RE.sub('', elem.text)
        return root


class CollectTasklistExtension(Extension):

    def extendMarkdown(self, md):
        collector = TasklistCollector(md)
        md.treeprocessors.register(collector, "collect-task-list", 24)


def emoji_to_unicode(index, shortname, alias, uc, alt, title, category, options, md):
    return alt

class MarkdownParser:

    def __init__(self, config):
        pass

    def parse(self, content):
        md = Markdown(extensions = ['meta'])
        lines = content.split('\n')
        lines = NormalizeWhitespace(md).run(lines)
        lines = MetaPreprocessor(md).run(lines)
        d = md.Meta.copy()
        d["content"] = '\n'.join(lines)
        return d

    def _md(self):
        return Markdown(
            extensions = [
                'pymdownx.arithmatex',
                'pymdownx.tasklist',
                'pymdownx.tilde',
                'codehilite',
                'sane_lists',
                'tables',
                'pymdownx.caret',
                'admonition',
                'pymdownx.emoji',
                'attr_list',
                'fenced_code',
                WikiLinkExtension()],
            extension_configs = {
                'pymdownx.tasklist': {
                    "custom_checkbox": True
                },
                'pymdownx.arithmatex': {
                    'generic': True,
                },
                'codehilite': {
                    'guess_lang': False
                },
                'pymdownx.emoji': {
                    'emoji_generator': emoji_to_unicode
                }
            })

    def convert(self, content):
        d = self.parse(content)
        md = self._md()
        html = md.convert(d["content"])
        links = list(md.wikilinks)
        if links:
            links.sort()
            d["link_i"] = links
        return d, html

    def format(self, metadata):
        body = metadata.pop("content", "")
        return ''.join(
            ''.join(f'{key}: {value}\n' for value in sorted(metadata[key]))
            for key in sorted(metadata)).encode() + b'\n' + body.encode()
