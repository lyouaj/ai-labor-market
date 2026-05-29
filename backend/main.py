import sys
import os

# ── Vercel serverless compatibility ───────────────────────────────────────────
# Ensure project root is in sys.path so that `backend` and `ml` packages
# can be resolved regardless of where the serverless runtime sets cwd.
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
# ──────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import router

app = FastAPI(
    title="AI Labor Market Analytics API",
    description="API for labor market analytics and layoff predictions",
    version="1.0.0"
)

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Welcome to AI Labor Market Analytics API"}
