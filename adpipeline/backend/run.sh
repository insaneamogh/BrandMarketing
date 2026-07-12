#!/usr/bin/env bash
# Start the FastAPI backend. Binds to $PORT (Railway injects it); defaults to 8000 locally.
set -e
cd "$(dirname "$0")"
uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload
