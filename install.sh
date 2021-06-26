#!/usr/bin/env bash

podman build -t etherpad dockerfiles
mkdir -p persistent
podman create --name etherpad -p 9001 -v "$(pwd)/persistent:/opt/etherpad-lite/persistent:z" localhost/etherpad
python3 -mvenv venv
source venv/bin/activate
pip install -r requirements.txt
