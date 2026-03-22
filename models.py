"""SQLAlchemy ORM models."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from database import Base


class Project(Base):
    __tablename__ = "projects"

    id:              Mapped[str]            = mapped_column(String(16), primary_key=True)
    name:            Mapped[str]            = mapped_column(String(255), nullable=False)

    # Parsed DBML data stored as JSON strings
    tables_data:     Mapped[str]            = mapped_column(Text, default="{}")
    groups_data:     Mapped[str]            = mapped_column(Text, default="{}")
    refs_data:       Mapped[str]            = mapped_column(Text, default="[]")
    ungrouped_data:  Mapped[str]            = mapped_column(Text, default="[]")

    # User-editable state
    saved_positions:  Mapped[str]           = mapped_column(Text, default="{}")
    notes_data:       Mapped[str]           = mapped_column(Text, default="[]")   # post-it notes
    markdown_notes:   Mapped[Optional[str]] = mapped_column(Text, default="")
    column_notes_data: Mapped[str]          = mapped_column(Text, default="{}")   # "table::col" → note
    enums_data:        Mapped[str]          = mapped_column(Text, default="[]")   # enum definitions from DBML
    views_data:        Mapped[str]          = mapped_column(Text, default="[]")   # saved join views
    doc_notes_data:    Mapped[str]          = mapped_column(Text, default="[]")   # multi-note docs
    table_notes_data:  Mapped[str]          = mapped_column(Text, default="{}")   # tname → table note override

    created_at:      Mapped[Optional[datetime]] = mapped_column(
        DateTime, server_default=func.now()
    )
