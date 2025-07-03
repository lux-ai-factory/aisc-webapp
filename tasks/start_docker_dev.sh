#!/bin/bash

# Docker Development Environment Startup Script for A4S webapp
# Purpose: Builds and runs the development environment in a Docker container
#
# This script:
# 1. Builds a development Docker image using Dockerfile.dev
# 2. Runs the container with:
#    - Volume mount for live code updates
#    - Named volume for node_modules to persist dependencies
#    - Port 5173 exposed for development server
#    - Interactive terminal mode
#    - Auto-removal on exit

docker build -f Dockerfile.dev -t a4s-webapp-dev .
docker run --rm -v .:/app -v a4s-webapp-node-modules:/app/node_modules -p 5173:5173 --name a4s-webapp-dev -it a4s-webapp-dev

