from markdown import Markdown
from markdown.extensions import Extension
from markdown.inlinepatterns import Pattern
from markdown.util import etree
from markdown.preprocessors import NormalizeWhitespace
from markdown.extensions.meta import MetaPreprocessor


def build_link(target, text=None):
    return f"/view/{target}" , text

class WikiLinks(Pattern):

    def handleMatch(self, m):
        target = m.group("target")
        text = m.group("text")
        text = text[1:] if text else None
        url, text = build_link(target, text)
        a = etree.Element('a')
        a.text = text
        a.set('href', url)
        a.set('target', '_parent')
        return a


class WikiLinkExtension(Extension):

    def extendMarkdown(self, md, md_globals):
        self.md = md
        WIKILINK_RE = r'\[\[(?P<target>[@\w/0-9:_ -\.]+)(?P<text>(?:\|[\w/0-9:_ -]+)?)\]\]'
        pattern = WikiLinks(WIKILINK_RE)
        pattern.md = md
        md.inlinePatterns.add('wikilink', pattern, "<not_strong")


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

    def convert(self, content):
        d = self.parse(content)
        md = Markdown(
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
        return md.convert(d["content"])

    def format(self, metadata):
        body = metadata.pop("content", "")
        return ''.join(
            ''.join(f'{key}: {value}\n' for value in metadata[key])
            for key in sorted(metadata)).encode() + b'\n' + body.encode()
