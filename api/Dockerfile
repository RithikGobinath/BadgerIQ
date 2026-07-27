FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY app ./app
COPY snapshot ./snapshot
COPY ingest ./ingest
COPY refresh.py .
RUN pip install --no-cache-dir .

ENV PYTHONUNBUFFERED=1

# Cloud Run injects PORT; default for local runs
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8100}"]
