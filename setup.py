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
      'lotek.host': ['templates/*.html', 'static/*.html', 'static/*.js', 'static/*.css'],
      'lotek.client': ['templates/*.html', 'static/*.html', 'static/*.js', 'static/*.css']
    },
    entry_points={
        'lotek_repos':
        [ 'git = lotek.repos.git:GitRepo',
        ],
    },
    install_requires = [
        'dulwich',
        'jsonpatch',
        'ruamel.yaml',
        'wheezy.web',
        'wheezy.template',
        'whoosh'
    ],
    extras_requires = {
      'odf': ['odfdo'],
      'pdf': ['pdfminer.six'],
      'markdown': ['markdown', 'pymdown-extensions', 'Pygments']
    }
)
