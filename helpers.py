"""Shared helper functions."""
import json
import re

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import Project


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


def _to_dict_minimal(p: Project) -> dict:
    """Lightweight dict for index page — deserialises only keys, not nested values."""
    tables_raw = json.loads(p.tables_data or "{}")
    groups_raw = json.loads(p.groups_data or "{}")
    return {
        "id":           p.id,
        "name":         p.name,
        "tables_count": len(tables_raw),
        "groups":       list(groups_raw.keys()),   # only group names needed
        "refs_count":   len(json.loads(p.refs_data or "[]")),
        "created_at":   p.created_at.strftime("%d/%m/%Y") if p.created_at else "",
    }


def _to_dict_tab(p: Project) -> dict:
    """Minimal dict for the project tab bar — only id and name."""
    return {"id": p.id, "name": p.name}


def _get_or_404(db: Session, pid: str) -> Project:
    p = db.get(Project, pid)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


def _validated_json(value: str, fallback: str) -> str:
    """Return value if valid JSON, else fallback."""
    try:
        json.loads(value)
        return value
    except (ValueError, TypeError):
        return fallback


def _safe_filename(name: str) -> str:
    """Sanitise a string for use as a download filename."""
    return re.sub(r'[^\w\-.]', '_', name)
