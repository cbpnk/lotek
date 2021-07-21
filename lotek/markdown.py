from markdown import Markdown

def emoji_to_unicode(index, shortname, alias, uc, alt, title, category, options, md):
    return alt

class MarkdownParser:

    def __init__(self, config):
        pass

    def parse(self, content):
        md = Markdown(extensions = ['meta'])
        lines = content.split('\n')
        for prep in md.preprocessors:
            lines = prep.run(lines)
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
                'attr_list'],
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
