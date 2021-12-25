from urllib.parse import urljoin

from markdown import Markdown

from .wopi import WOPIBaseHandler


def emoji_to_unicode(index, shortname, alias, uc, alt, title, category, options, md):
    return alt


class Handler(WOPIBaseHandler):

    def render_html(self):
        info = self.get_info()
        content = self.get_content().read()
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
                'fenced_code'],
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

        return self.render_response(
            'markdown.html',
            TITLE = info["BaseFileName"] + info['FileExtension'],
            HTML = md.convert(content.decode()),
            WOPISrc = self.src,
            access_token = self.access_token,
            hypothesis_url = urljoin(self.src, "/")
        )
