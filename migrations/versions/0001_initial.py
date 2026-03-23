"""Initial schema — full projects table.

Revision ID: 0001
Revises:
Create Date: 2026-03-23

For existing databases (created before Alembic was introduced) the table
already exists with all columns, so we skip creation gracefully.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "projects" in inspector.get_table_names():
        # DB already exists — nothing to do for this migration.
        return

    op.create_table(
        "projects",
        sa.Column("id", sa.String(16), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("tables_data", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("groups_data", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("refs_data", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("ungrouped_data", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("saved_positions", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("notes_data", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("markdown_notes", sa.Text(), nullable=True),
        sa.Column("column_notes_data", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("enums_data", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("views_data", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("doc_notes_data", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("table_notes_data", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("projects")
