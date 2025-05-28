#!/bin/bash

docker build -f Dockerfile.dev -t a4s-webapp-dev .
docker run --rm -v .:/app -p 5173:5173 --name a4s-webapp-dev -it a4s-webapp-dev

