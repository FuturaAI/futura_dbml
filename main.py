"""FastAPI application — DBML Docs."""
import csv
import io
import json
import uuid
from pathlib import Path

import uvicorn
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from sqlalchemy import text

from database import Base, engine, get_db
from models import Project
from parser import parse_dbml

# ── Bootstrap ─────────────────────────────────────────────────────────────────

Base.metadata.create_all(bind=engine)

# Migration: add enums_data column to existing DBs (idempotent)
with engine.connect() as _conn:
    try:
        _conn.execute(text("ALTER TABLE projects ADD COLUMN enums_data TEXT NOT NULL DEFAULT '[]'"))
        _conn.commit()
    except Exception:
        pass  # column already exists
    try:
        _conn.execute(text("ALTER TABLE projects ADD COLUMN views_data TEXT NOT NULL DEFAULT '[]'"))
        _conn.commit()
    except Exception:
        pass  # column already exists
    try:
        _conn.execute(text("ALTER TABLE projects ADD COLUMN doc_notes_data TEXT NOT NULL DEFAULT '[]'"))
        _conn.commit()
    except Exception:
        pass  # column already exists
    try:
        _conn.execute(text("ALTER TABLE projects ADD COLUMN table_notes_data TEXT NOT NULL DEFAULT '{}'"))
        _conn.commit()
    except Exception:
        pass  # column already exists

app = FastAPI(title="DBML Docs")

BASE_DIR = Path(__file__).parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_dict(p: Project) -> dict:
    return {
        "id":              p.id,
        "name":            p.name,
        "tables":          json.loads(p.tables_data          or "{}"),
        "groups":          json.loads(p.groups_data          or "{}"),
        "refs":            json.loads(p.refs_data            or "[]"),
        "ungrouped":       json.loads(p.ungrouped_data       or "[]"),
        "saved_positions": json.loads(p.saved_positions      or "{}"),
        "notes":           json.loads(p.notes_data           or "[]"),
        "markdown_notes":  p.markdown_notes                  or "",
        "column_notes":    json.loads(p.column_notes_data    or "{}"),
        "enums":           json.loads(p.enums_data           or "[]"),
        "views":           json.loads(p.views_data           or "[]"),
        "doc_notes":       json.loads(p.doc_notes_data       or "[]"),
        "table_notes":     json.loads(p.table_notes_data     or "{}"),
        "created_at":      p.created_at.strftime("%d/%m/%Y") if p.created_at else "",
    }


def _get_or_404(db: Session, pid: str) -> Project:
    p = db.get(Project, pid)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


# ── Pages ─────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request, db: Session = Depends(get_db)):
    projects = [_to_dict(p) for p in db.query(Project).order_by(Project.name).all()]
    return templates.TemplateResponse("index.html", {
        "request": request, "projects": projects,
    })


@app.post("/upload")
async def upload(
    request: Request,
    file: UploadFile = File(...),
    name: str = Form(...),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    try:
        parsed = parse_dbml(content)
    except Exception as exc:
        projects = [_to_dict(p) for p in db.query(Project).order_by(Project.name).all()]
        return templates.TemplateResponse("index.html", {
            "request": request, "projects": projects, "error": str(exc),
        })

    project = Project(
        id             = str(uuid.uuid4())[:8],
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


@app.get("/project/{pid}", response_class=HTMLResponse)
async def project_view(request: Request, pid: str, db: Session = Depends(get_db)):
    project      = _to_dict(_get_or_404(db, pid))
    all_projects = [_to_dict(p) for p in db.query(Project).order_by(Project.name).all()]
    return templates.TemplateResponse("project.html", {
        "request":      request,
        "project":      project,
        "project_json": json.dumps(project),
        "all_projects": all_projects,
    })


@app.post("/project/{pid}/delete")
async def delete_project(pid: str, db: Session = Depends(get_db)):
    p = db.get(Project, pid)
    if p:
        db.delete(p)
        db.commit()
    return RedirectResponse("/", status_code=303)


# ── API – state persistence ───────────────────────────────────────────────────

@app.post("/project/{pid}/positions")
async def save_positions(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.saved_positions = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


@app.post("/project/{pid}/notes")
async def save_notes(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.notes_data = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


@app.post("/project/{pid}/rename")
async def rename_project(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    body = await request.json()
    name = body.get("name", "").strip()
    if name:
        p.name = name
        db.commit()
    return {"ok": True, "name": p.name}


@app.post("/project/{pid}/markdown")
async def save_markdown(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    body = await request.json()
    p.markdown_notes = body.get("content", "")
    db.commit()
    return {"ok": True}


@app.post("/project/{pid}/table_notes")
async def save_table_notes(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.table_notes_data = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


@app.post("/project/{pid}/doc_notes")
async def save_doc_notes(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.doc_notes_data = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


@app.post("/project/{pid}/views")
async def save_view(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    body = await request.json()
    views = json.loads(p.views_data or "[]")
    view_id = str(uuid.uuid4())[:8]
    views.append({**body, "id": view_id})
    p.views_data = json.dumps(views)
    db.commit()
    return {"ok": True, "id": view_id}


@app.put("/project/{pid}/views/{vid}")
async def update_view(pid: str, vid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    body = await request.json()
    views = json.loads(p.views_data or "[]")
    for v in views:
        if v.get("id") == vid:
            v.update({k: val for k, val in body.items() if k != "id"})
            break
    p.views_data = json.dumps(views)
    db.commit()
    return {"ok": True}


@app.delete("/project/{pid}/views/{vid}")
async def delete_view(pid: str, vid: str, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    views = json.loads(p.views_data or "[]")
    p.views_data = json.dumps([v for v in views if v.get("id") != vid])
    db.commit()
    return {"ok": True}


@app.post("/project/{pid}/column_notes")
async def save_column_notes(pid: str, request: Request, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    p.column_notes_data = json.dumps(await request.json())
    db.commit()
    return {"ok": True}


@app.post("/project/{pid}/reupload")
async def reupload_project(
    pid: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    p = _get_or_404(db, pid)
    raw = await file.read()
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
    # Keep positions for tables that still exist; drop positions for removed tables
    old_positions = json.loads(p.saved_positions or "{}")
    new_table_keys = set(parsed["tables"].keys())
    p.saved_positions = json.dumps({k: v for k, v in old_positions.items() if k in new_table_keys})
    db.commit()
    return RedirectResponse(f"/project/{pid}", status_code=303)


@app.get("/project/{pid}/export")
async def export_project(pid: str, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "name", "tables_data", "groups_data", "refs_data",
        "ungrouped_data", "saved_positions", "notes_data",
        "markdown_notes", "column_notes_data", "enums_data", "views_data", "doc_notes_data",
    ])
    writer.writerow([
        p.id,
        p.name,
        p.tables_data    or "{}",
        p.groups_data    or "{}",
        p.refs_data      or "[]",
        p.ungrouped_data or "[]",
        p.saved_positions or "{}",
        p.notes_data     or "[]",
        p.markdown_notes or "",
        p.column_notes_data or "{}",
        p.enums_data     or "[]",
        p.views_data     or "[]",
        p.doc_notes_data or "[]",
    ])
    filename = p.name.replace(" ", "_") + ".dbmldoc.csv"
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/import-project")
async def import_project(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(content))
    row = next(reader, None)
    if not row or "tables_data" not in row:
        raise HTTPException(status_code=400, detail="File CSV non valido o non riconosciuto")

    new_p = Project(
        id                = str(uuid.uuid4())[:8],
        name              = row.get("name", "Progetto importato"),
        tables_data       = row.get("tables_data",       "{}"),
        groups_data       = row.get("groups_data",       "{}"),
        refs_data         = row.get("refs_data",         "[]"),
        ungrouped_data    = row.get("ungrouped_data",    "[]"),
        saved_positions   = row.get("saved_positions",   "{}"),
        notes_data        = row.get("notes_data",        "[]"),
        markdown_notes    = row.get("markdown_notes",    ""),
        column_notes_data = row.get("column_notes_data", "{}"),
        enums_data        = row.get("enums_data",        "[]"),
        views_data        = row.get("views_data",        "[]"),
        doc_notes_data    = row.get("doc_notes_data",    "[]"),
    )
    db.add(new_p)
    db.commit()
    return RedirectResponse(f"/project/{new_p.id}", status_code=303)


@app.post("/project/{pid}/duplicate")
async def duplicate_project(pid: str, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    new_p = Project(
        id                = str(uuid.uuid4())[:8],
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
    )
    db.add(new_p)
    db.commit()
    return RedirectResponse(f"/project/{new_p.id}", status_code=303)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
