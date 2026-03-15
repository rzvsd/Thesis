FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential wget \
    && rm -rf /var/lib/apt/lists/*

COPY apps/news-ingest/requirements.txt /tmp/news-ingest-requirements.txt

RUN python -m pip install --no-cache-dir -r /tmp/news-ingest-requirements.txt

COPY apps/news-ingest /app/apps/news-ingest
COPY data/golden /app/data/golden
COPY packages/contracts/schemas /app/packages/contracts/schemas

ENV PYTHONPATH=/app/apps/news-ingest/src

EXPOSE 3004

CMD ["python", "-m", "news_ingest"]
