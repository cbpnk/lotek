from zipfile import ZipFile
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

NAME = 'Mozilla Archive Format'

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

def get_indexfilename(maff, name):
    root = ET.fromstring(maff.read(f"{name}/index.rdf"))
    return root.find("./RDF:Description/MAF:indexfilename", NAMESPACES).attrib[RESOURCE]

def extract_metadata(f):
    maff = ZipFile(f)
    name = get_topdir(maff)
    root = ET.fromstring(maff.read(f"{name}/index.rdf"))
    originalurl = root.find("./RDF:Description/MAF:originalurl", NAMESPACES).attrib[RESOURCE]
    title = root.find("./RDF:Description/MAF:title", NAMESPACES).attrib[RESOURCE]
    archivetime = root.find("./RDF:Description/MAF:archivetime", NAMESPACES).attrib[RESOURCE]
    archivetime = parsedate_to_datetime(archivetime)

    return {
        "originalurl_s": originalurl,
        "title_t": title,
        "archive_d": archivetime.isoformat()
    }

def extract_content(f):
    return []
