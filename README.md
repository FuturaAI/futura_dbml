# DBML Docs

Strumento di documentazione interattiva per database a partire da file `.dbml`.

## Funzionalità

- Caricamento file `.dbml` con parsing automatico
- Diagramma interattivo con tabelle draggabili e connessioni SVG
- Raggruppamento tabelle per `TableGroup`
- Visibilità per gruppo e per singola tabella (occhio)
- Post-it sticky notes sul canvas
- Editor Markdown per appunti del progetto
- Posizioni e note persistite sul DB
- Tab per navigare tra più progetti

## Stack

- **Backend**: FastAPI + SQLAlchemy
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Frontend**: Vanilla JS, EasyMDE, Marked.js

## Avvio locale

```bash
uv sync
uv run python main.py
```

Apri [http://localhost:8000](http://localhost:8000)

## Docker

**Dev (SQLite):**
```bash
docker compose up --build
```

**Prod (PostgreSQL):**
```bash
POSTGRES_PASSWORD=secret docker compose -f docker-compose.prod.yml up -d
```

> Prima del primo build in prod genera il lock file con `uv lock`.
