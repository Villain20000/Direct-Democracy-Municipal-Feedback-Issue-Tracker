# Postgres image with BOTH pgvector (for RAG embeddings) and
# postgis (for spatial queries). The default `pgvector/pgvector:pg16`
# image doesn't include postgis, and the default `postgis/postgis`
# image doesn't include pgvector — we need both for the
# Direct Democracy project, so we extend the pgvector image and
# install postgis on top of it.
#
# To rebuild after editing this file:
#   docker compose -f docker/docker-compose.yml build postgres
#
# If you don't need PostGIS (e.g. a CI matrix that only tests
# the RAG path), you can use the bare `pgvector/pgvector:pg16`
# image by setting `POSTGRES_IMAGE=pgvector/pgvector:pg16` in
# your shell before `docker compose up`.
FROM pgvector/pgvector:pg16

# Install PostGIS 3 for Postgres 16. The package name follows the
# pattern `postgresql-<major>-postgis-<major>`. Pinned to match the
# Postgres 16 / PostGIS 3.x line so a `apt-get update` doesn't
# accidentally bring in a major-version bump.
ARG POSTGIS_MAJOR=3
ARG PG_MAJOR=16

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-${PG_MAJOR}-postgis-${POSTGIS_MAJOR} \
    && rm -rf /var/lib/apt/lists/*

# PostGIS is now installed as a server extension. Enable it in the
# default database by creating a template. The actual
# `CREATE EXTENSION postgis;` call lives in the migration
# (20260617000000_postgis_spatial/migration.sql) so a fresh
# dev DB and a CI DB both get it without rebuilding this image.
#
# Healthcheck is inherited from the base image (`pg_isready`), which
# is what `docker-compose.yml`'s `condition: service_healthy` is
# already checking. Nothing more to add here.
