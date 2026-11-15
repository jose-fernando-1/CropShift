# Cropshift API image. Build context is the REPOSITORY ROOT (see docker-compose.yml):
#   docker build -f backend/Dockerfile --target runtime .   # the API
#   docker build -f backend/Dockerfile --target tools .     # API code + data/ ETL (seed, validation)
# The API reads only the database at runtime; data/ lives in the `tools` target alone.

FROM python:3.13-slim-bookworm AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN useradd --system --uid 10001 --create-home --shell /usr/sbin/nologin app
WORKDIR /srv/backend

FROM base AS deps
COPY backend/requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt

FROM base AS runtime
COPY --from=deps /install /usr/local
COPY --chown=app:app backend/alembic.ini ./
COPY --chown=app:app backend/alembic ./alembic
COPY --chown=app:app backend/app ./app
USER app
EXPOSE 8000
# `--no-access-log`: the app logs method, path and status itself and never the query string.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

FROM runtime AS tools
HEALTHCHECK NONE
USER root
COPY data/requirements.txt /srv/data/requirements.txt
RUN pip install -r /srv/data/requirements.txt
COPY --chown=app:app data /srv/data
COPY --chown=app:app contract /srv/contract
ENV PYTHONPATH=/srv/backend:/srv
WORKDIR /srv
USER app
ENTRYPOINT ["python", "-m", "data"]
CMD ["--help"]
