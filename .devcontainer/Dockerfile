FROM mcr.microsoft.com/devcontainers/python:1-3.13-bookworm
# The base image ships a Yarn apt source whose signing key is no longer valid; `apt-get update` then fails inside
# every devcontainer feature. Yarn is not used here (npm only).
RUN rm -f /etc/apt/sources.list.d/yarn.list
