from zipfile import ZipFile
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

EXT = ".maff"

NAMESPACES = {
    "MAF": "http://maf.mozdev.org/metadata/rdf#",
    "RDF": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
}
RESOURCE = "{" + NAMESPACES["RDF"] + "}resource"

def get_topdir(maff):
    topdirs = set(name.split("/", 1)[0] for name in maff.namelist())
    assert len(topdirs) == 1
    name = list(topdirs)[0]
    return name


def extract_metadata(f):
    maff = ZipFile(f)
    name = get_topdir(maff)
    root = ET.fromstring(maff.read(f"{name}/index.rdf"))
    originalurl = root.find("./RDF:Description/MAF:originalurl", NAMESPACES).attrib[RESOURCE]
    title = root.find("./RDF:Description/MAF:title", NAMESPACES).attrib[RESOURCE]
    archivetime = root.find("./RDF:Description/MAF:archivetime", NAMESPACES).attrib[RESOURCE]
    archivetime = parsedate_to_datetime(archivetime)

    return {
        "category_i": ["maff"],
        "maff__originalurl_i": [originalurl],
        "title_t": [title],
        "maff__archive_d": [archivetime.isoformat()]
    }


def index_file(path, add_document):
    pass

def render_context(filename, f):
    maff = ZipFile(f)
    name = get_topdir(maff)
    root = ET.fromstring(maff.read(f"{name}/index.rdf"))
    indexfilename = root.find("./RDF:Description/MAF:indexfilename", NAMESPACES).attrib[RESOURCE]
    return {"indexfilename": f"/{filename}!/{name}/{indexfilename}"}
