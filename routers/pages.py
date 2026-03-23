"""HTML page routes."""
import json
import os

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pathlib import Path
from sqlalchemy.orm import Session

from parsers.sql    import parse_sql
from parsers.prisma import parse_prisma
from parsers.orm    import parse_django, parse_sqlalchemy

_CODE_PARSERS = {
    "sql":        parse_sql,
    "prisma":     parse_prisma,
    "django":     parse_django,
    "sqlalchemy": parse_sqlalchemy,
}

from database import get_db
from helpers import _get_or_404, _to_dict, _to_dict_minimal, _to_dict_tab
from models import Project
from parser import parse_dbml

import uuid

router = APIRouter()
templates = Jinja2Templates(directory=Path(__file__).parent.parent / "templates")

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))


@router.get("/", response_class=HTMLResponse)
async def index(request: Request, db: Session = Depends(get_db)):
    projects = [_to_dict_minimal(p) for p in db.query(Project).order_by(Project.name).all()]
    return templates.TemplateResponse("index.html", {
        "request": request, "projects": projects,
    })


@router.post("/upload")
async def upload(
    request: Request,
    file: UploadFile = File(...),
    name: str = Form(...),
    db: Session = Depends(get_db),
):
    # Query once — reused in all error paths
    def _projects():
        return [_to_dict_minimal(p) for p in db.query(Project).order_by(Project.name).all()]

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
        return templates.TemplateResponse("index.html", {
            "request": request, "projects": _projects(),
            "error": f"File troppo grande (max {MAX_UPLOAD_MB} MB).",
        })
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    try:
        parsed = parse_dbml(content)
    except Exception as exc:
        return templates.TemplateResponse("index.html", {
            "request": request, "projects": _projects(), "error": str(exc),
        })

    project = Project(
        id             = uuid.uuid4().hex[:12],
        name           = name.strip() or file.filename,
        tables_data    = json.dumps(parsed["tables"]),
        groups_data    = json.dumps(parsed["groups"]),
        refs_data      = json.dumps(parsed["refs"]),
        ungrouped_data = json.dumps(parsed["ungrouped"]),
        enums_data     = json.dumps(parsed["enums"]),
    )
    db.add(project)
    db.commit()
    return RedirectResponse(f"/project/{project.id}", status_code=303)


@router.get("/project/{pid}", response_class=HTMLResponse)
async def project_view(request: Request, pid: str, db: Session = Depends(get_db)):
    project  = _to_dict(_get_or_404(db, pid))
    all_tabs = [_to_dict_tab(p) for p in db.query(Project).order_by(Project.name).all()]
    return templates.TemplateResponse("project.html", {
        "request":      request,
        "project":      project,
        "project_json": json.dumps(project),
        "all_projects": all_tabs,
    })


@router.post("/project/{pid}/delete")
async def delete_project(pid: str, db: Session = Depends(get_db)):
    p = db.get(Project, pid)
    if p:
        db.delete(p)
        db.commit()
    return RedirectResponse("/", status_code=303)


@router.post("/project/{pid}/duplicate")
async def duplicate_project(pid: str, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    new_p = Project(
        id                = uuid.uuid4().hex[:12],
        name              = p.name + " (copia)",
        tables_data       = p.tables_data,
        groups_data       = p.groups_data,
        refs_data         = p.refs_data,
        ungrouped_data    = p.ungrouped_data,
        saved_positions   = p.saved_positions,
        notes_data        = p.notes_data,
        markdown_notes    = p.markdown_notes,
        column_notes_data = p.column_notes_data,
        enums_data        = p.enums_data,
        views_data        = p.views_data,
        doc_notes_data    = p.doc_notes_data,
        table_notes_data  = p.table_notes_data,
    )
    db.add(new_p)
    db.commit()
    return RedirectResponse(f"/project/{new_p.id}", status_code=303)


@router.post("/project/{pid}/reupload")
async def reupload_project(
    pid: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    from fastapi import HTTPException
    p = _get_or_404(db, pid)
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File troppo grande (max {MAX_UPLOAD_MB} MB).")
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")
    try:
        parsed = parse_dbml(content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    p.tables_data    = json.dumps(parsed["tables"])
    p.groups_data    = json.dumps(parsed["groups"])
    p.refs_data      = json.dumps(parsed["refs"])
    p.ungrouped_data = json.dumps(parsed["ungrouped"])
    p.enums_data     = json.dumps(parsed["enums"])

    new_table_keys = set(parsed["tables"].keys())

    # Keep positions only for tables that still exist
    old_positions = json.loads(p.saved_positions or "{}")
    p.saved_positions = json.dumps({k: v for k, v in old_positions.items() if k in new_table_keys})

    # Drop column notes for removed tables
    old_col_notes = json.loads(p.column_notes_data or "{}")
    p.column_notes_data = json.dumps(
        {k: v for k, v in old_col_notes.items() if k.split("::")[0] in new_table_keys}
    )

    # Drop table note overrides for removed tables
    old_table_notes = json.loads(p.table_notes_data or "{}")
    p.table_notes_data = json.dumps({k: v for k, v in old_table_notes.items() if k in new_table_keys})

    # Drop views whose root table no longer exists
    old_views = json.loads(p.views_data or "[]")
    p.views_data = json.dumps([v for v in old_views if v.get("root") in new_table_keys])

    db.commit()
    return RedirectResponse(f"/project/{pid}", status_code=303)


@router.post("/upload-code")
async def upload_code(
    request: Request,
    name:    str  = Form(default=""),
    fmt:     str  = Form(default="sql"),
    content: str  = Form(...),
    db: Session   = Depends(get_db),
):
    def _projects():
        return [_to_dict_minimal(p) for p in db.query(Project).order_by(Project.name).all()]

    parser = _CODE_PARSERS.get(fmt)
    if not parser:
        return templates.TemplateResponse("index.html", {
            "request": request, "projects": _projects(),
            "error": f"Formato non supportato: {fmt}",
        })

    try:
        parsed = parser(content)
    except Exception as exc:
        return templates.TemplateResponse("index.html", {
            "request": request, "projects": _projects(), "error": str(exc),
        })

    if not parsed["tables"]:
        return templates.TemplateResponse("index.html", {
            "request": request, "projects": _projects(),
            "error": "Nessuna tabella trovata nel contenuto incollato.",
        })

    project = Project(
        id             = uuid.uuid4().hex[:12],
        name           = name.strip() or f"Import {fmt}",
        tables_data    = json.dumps(parsed["tables"]),
        groups_data    = json.dumps(parsed["groups"]),
        refs_data      = json.dumps(parsed["refs"]),
        ungrouped_data = json.dumps(parsed["ungrouped"]),
        enums_data     = json.dumps(parsed["enums"]),
    )
    db.add(project)
    db.commit()
    return RedirectResponse(f"/project/{project.id}", status_code=303)
