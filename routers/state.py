"""State-persistence API routes (positions, notes, views, etc.)."""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from helpers import _get_or_404
from models import Project

router = APIRouter(prefix="/project/{pid}")


@router.post("/positions")
async def save_positions(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.saved_positions = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


@router.post("/notes")
async def save_notes(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.notes_data = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


@router.post("/rename")
async def rename_project(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    body = await request.json()
    name = body.get("name", "").strip()
    if name:
        p.name = name
        db.commit()
    return {"ok": True, "name": p.name}


@router.post("/markdown")
async def save_markdown(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    body = await request.json()
    p.markdown_notes = body.get("content", "")
    db.commit()
    return {"ok": True}


@router.post("/table_notes")
async def save_table_notes(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.table_notes_data = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


@router.post("/doc_notes")
async def save_doc_notes(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.doc_notes_data = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


@router.post("/column_notes")
async def save_column_notes(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.column_notes_data = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


# ── Views ────────────────────────────────────────────────────────────────────

def _get_project_locked(db: Session, pid: str) -> Project:
    """SELECT ... FOR UPDATE to prevent concurrent view modifications."""
    p = db.execute(select(Project).where(Project.id == pid).with_for_update()).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.post("/views")
async def save_view(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_project_locked(db, pid)
    body = await request.json()
    views = json.loads(p.views_data or "[]")
    view_id = uuid.uuid4().hex[:12]
    views.append({**body, "id": view_id})
    p.views_data = json.dumps(views)
    db.commit()
    return {"ok": True, "id": view_id}


@router.put("/views/{vid}")
async def update_view(pid: str, vid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_project_locked(db, pid)
    body = await request.json()
    views = json.loads(p.views_data or "[]")
    for v in views:
        if v.get("id") == vid:
            v.update({k: val for k, val in body.items() if k != "id"})
            break
    p.views_data = json.dumps(views)
    db.commit()
    return {"ok": True}


@router.delete("/views/{vid}")
async def delete_view(pid: str, vid: str, db: Session = Depends(get_db)):
    p = _get_project_locked(db, pid)
    views = json.loads(p.views_data or "[]")
    p.views_data = json.dumps([v for v in views if v.get("id") != vid])
    db.commit()
    return {"ok": True}
