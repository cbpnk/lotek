from odfdo import Document, Container

NAME = 'OpenOffice Text'

def extract_metadata(f):
   doc = Document(Container(f))
   meta = doc.get_part("meta.xml")

   metadata = {}

   title = meta.get_title()
   if title:
       metadata["title_t"] = title

   return metadata


def extract_content(f):
    doc = Document(Container(f))
    yield None, None, doc.get_formatted_text()


def init_new_file(f):
    doc = Document.new("text")
    doc.save(f)
    f.seek(0)
