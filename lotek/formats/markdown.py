NAME = 'Markdown'

def extract_metadata(f):
    return {}

def extract_content(f):
    yield None, None, f.read().decode()

def init_new_file(f):
    pass
