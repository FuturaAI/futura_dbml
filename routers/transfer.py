"""Export and import routes (JSON format)."""
import json
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from helpers import _get_or_404, _safe_filename, _validated_json
from models import Project

router = APIRouter()

_FIELDS = [
    "tables_data", "groups_data", "refs_data", "ungrouped_data",
    "saved_positions", "notes_data", "markdown_notes", "column_notes_data",
    "enums_data", "views_data", "doc_notes_data", "table_notes_data",
]


@router.get("/project/{pid}/export")
async def export_project(pid: str, db: Session = Depends(get_db)):
    p = _get_or_404(db, pid)
    payload = {
        "id":                p.id,
        "name":              p.name,
        "tables_data":       p.tables_data       or "{}",
        "groups_data":       p.groups_data       or "{}",
        "refs_data":         p.refs_data         or "[]",
        "ungrouped_data":    p.ungrouped_data    or "[]",
        "saved_positions":   p.saved_positions   or "{}",
        "notes_data":        p.notes_data        or "[]",
        "markdown_notes":    p.markdown_notes    or "",
        "column_notes_data": p.column_notes_data or "{}",
        "enums_data":        p.enums_data        or "[]",
        "views_data":        p.views_data        or "[]",
        "doc_notes_data":    p.doc_notes_data    or "[]",
        "table_notes_data":  p.table_notes_data  or "{}",
    }
    filename = _safe_filename(p.name) + ".dbmldoc.json"
    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import-project")
async def import_project(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    try:
        row = json.loads(content)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="File JSON non valido o non riconosciuto")

    if "tables_data" not in row:
        raise HTTPException(status_code=400, detail="File JSON non valido o non riconosciuto")

    new_p = Project(
        id                = uuid.uuid4().hex[:12],
        name              = row.get("name", "Progetto importato"),
        tables_data       = _validated_json(row.get("tables_data",       "{}"), "{}"),
        groups_data       = _validated_json(row.get("groups_data",       "{}"), "{}"),
        refs_data         = _validated_json(row.get("refs_data",         "[]"), "[]"),
        ungrouped_data    = _validated_json(row.get("ungrouped_data",    "[]"), "[]"),
        saved_positions   = _validated_json(row.get("saved_positions",   "{}"), "{}"),
        notes_data        = _validated_json(row.get("notes_data",        "[]"), "[]"),
        markdown_notes    = row.get("markdown_notes", ""),
        column_notes_data = _validated_json(row.get("column_notes_data", "{}"), "{}"),
        enums_data        = _validated_json(row.get("enums_data",        "[]"), "[]"),
        views_data        = _validated_json(row.get("views_data",        "[]"), "[]"),
        doc_notes_data    = _validated_json(row.get("doc_notes_data",    "[]"), "[]"),
        table_notes_data  = _validated_json(row.get("table_notes_data",  "{}"), "{}"),
    )
    db.add(new_p)
    db.commit()
    return RedirectResponse(f"/project/{new_p.id}", status_code=303)
