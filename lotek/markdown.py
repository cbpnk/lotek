from markdown import Markdown


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
        md = Markdown(extensions = [])
        html = md.convert(d["content"])
        d["html"] = html
        return d

    def format(self, metadata):
        body = metadata.pop("content", "")
        return ''.join(
            ''.join(f'{key}: {value}\n' for value in metadata[key])
            for key in sorted(metadata)).encode() + b'\n' + body.encode()
