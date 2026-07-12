#!/usr/bin/env bash
# Start the FastAPI backend on :8000
set -e
cd "$(dirname "$0")"
uvicorn main:app --reload --port 8000
