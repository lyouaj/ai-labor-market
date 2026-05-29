"""
api/index.py — Vercel serverless entrypoint for FastAPI.

Vercel's @vercel/python builder auto-detects FastAPI apps in api/index.py.
We simply re-export the `app` object from backend/main.py.
"""
import sys
import os

# Add project root to sys.path so backend.* and ml.* imports resolve correctly.
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.main import app  # noqa: F401  — Vercel picks up `app` from here
