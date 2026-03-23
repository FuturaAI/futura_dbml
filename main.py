"""FastAPI application — DBML Docs."""
from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from routers import pages, state, transfer

# ── Startup: run Alembic migrations ──────────────────────────────────────────

def _run_migrations() -> None:
    alembic_cfg = Config(Path(__file__).parent / "alembic.ini")
    command.upgrade(alembic_cfg, "head")

_run_migrations()

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="DBML Docs")

BASE_DIR = Path(__file__).parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

app.include_router(pages.router)
app.include_router(state.router)
app.include_router(transfer.router)

# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
