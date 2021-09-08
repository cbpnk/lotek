#!/usr/bin/env python3

from setuptools import setup, find_packages

setup(
    name = 'lotek',
    version = '0.0.0',

    url = 'https://github.com/cbpnk/lotek',
    description = '',
    license = '',

    classifiers = [
        "Development Status :: 1 - Planning",
        "Operating System :: POSIX :: Linux",
        "Programming Language :: Python :: 3 :: Only",
    ],

    packages = find_packages(),
    package_data = {
      'lotek': ['templates/*.html', 'static/*.html', 'static/*.js', 'static/*.css']
    },
    entry_points={
        'lotek_editors':
        [ 'textarea = lotek.textarea:TextArea',
          'feishu = lotek.feishu:FeishuTenant'
        ],
        'lotek_txt_formats':
        [ 'markdown = lotek.markdown:MarkdownParser',
        ],
        'lotek_media_formats':
        [ 'pdf = lotek.pdf',
          'maff = lotek.maff',
        ],
    },
    install_requires = [
        'dulwich',
        'jsonpatch',
        'markdown',
        'pdfminer.six',
        'wheezy.http',
        'wheezy.routing',
        'wheezy.template',
        'whoosh',
        'pymdown-extensions',
        'Pygments'
    ],
)
