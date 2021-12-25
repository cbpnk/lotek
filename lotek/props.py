from io import StringIO

from ruamel.yaml import YAML

yaml = YAML()


def encode(value):
    buf = StringIO()
    yaml.dump(value, buf)
    return buf.getvalue().encode()

def decode(data):
    return yaml.load(data)
