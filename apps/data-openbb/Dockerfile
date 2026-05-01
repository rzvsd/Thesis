FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential git wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/data-openbb

ARG INSTALL_LIVE_OPENBB=false

COPY apps/data-openbb/requirements.txt /tmp/data-openbb-requirements.txt
COPY apps/data-openbb/requirements-live.txt /tmp/data-openbb-requirements-live.txt
RUN python -m pip install --disable-pip-version-check --no-cache-dir -r /tmp/data-openbb-requirements.txt
RUN if [ "$INSTALL_LIVE_OPENBB" = "true" ]; then \
      python -m pip install --disable-pip-version-check --no-cache-dir -r /tmp/data-openbb-requirements-live.txt; \
    fi

COPY apps/data-openbb /app/apps/data-openbb
COPY data/golden/data-openbb /app/data/golden/data-openbb
COPY data/sp500_universe.csv /app/data/sp500_universe.csv
COPY data/xbrl_concept_map.json /app/data/xbrl_concept_map.json
COPY packages/contracts/schemas /app/packages/contracts/schemas
COPY packages/redis-client /app/packages/redis-client

EXPOSE 3003

CMD ["python", "-B", "-m", "src.server"]
