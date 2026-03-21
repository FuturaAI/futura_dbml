"""Database engine & session factory.

DATABASE_URL env var controls the backend:
  - SQLite (default, dev):  sqlite:///./data/app.db
  - PostgreSQL (prod):      postgresql://user:pass@host:5432/dbname
"""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")

# Heroku / Render ship "postgres://" — SQLAlchemy requires "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite: ensure the data directory exists and disable same-thread check
_is_sqlite = DATABASE_URL.startswith("sqlite")
if _is_sqlite:
    _db_path = DATABASE_URL.split("///")[-1]
    Path(_db_path).parent.mkdir(parents=True, exist_ok=True)

_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# FastAPI dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
