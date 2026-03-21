FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Copia solo i file di dipendenze per sfruttare la cache dei layer
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache --no-install-project

# Copia il codice sorgente
COPY . .

RUN mkdir -p data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
