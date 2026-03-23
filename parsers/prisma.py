"""Prisma schema parser."""
import re


# Scalar types → SQL equivalents
_PRISMA_TYPES: dict[str, str] = {
    "Int": "integer", "BigInt": "bigint", "Float": "float",
    "Decimal": "decimal", "String": "varchar", "Boolean": "boolean",
    "DateTime": "timestamp", "Date": "date", "Time": "time",
    "Json": "json", "Bytes": "bytea",
}

_MODEL_RE = re.compile(r'\bmodel\s+(\w+)\s*\{([^}]+)\}', re.DOTALL)
_ENUM_RE  = re.compile(r'\benum\s+(\w+)\s*\{([^}]+)\}',  re.DOTALL)
_RELATION_RE = re.compile(
    r'@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\]'
)


def parse_prisma(content: str) -> dict:
    tables: dict[str, dict] = {}
    refs:   list[dict]      = []
    fk_set: set[tuple]      = set()
    enums:  list[dict]      = []

    # ── Enums ────────────────────────────────────────────────
    for m in _ENUM_RE.finditer(content):
        name   = m.group(1)
        values = [
            v.strip() for v in m.group(2).splitlines()
            if v.strip() and not v.strip().startswith("//")
        ]
        enums.append({"name": name, "schema": "", "full_name": name, "values": values})

    known_enums = {e["name"] for e in enums}

    # ── Models ───────────────────────────────────────────────
    for m in _MODEL_RE.finditer(content):
        model_name = m.group(1)
        body       = m.group(2)

        tables[model_name] = {
            "name": model_name, "schema": "", "full_name": model_name,
            "note": None, "columns": [],
        }

        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith("//") or line.startswith("@@"):
                continue

            parts = line.split()
            if len(parts) < 2:
                continue

            col_name  = parts[0]
            type_raw  = parts[1]          # e.g. "String", "String?", "Post[]"
            is_list   = "[]" in type_raw
            is_opt    = type_raw.endswith("?")
            base_type = type_raw.rstrip("?").rstrip("[]")
            rest      = " ".join(parts[2:])

            # Skip list relation fields (one-to-many back-references)
            if is_list:
                continue

            # Skip relation-only fields (type is another model, not scalar/enum)
            is_scalar = base_type in _PRISMA_TYPES or base_type in known_enums
            has_relation = bool(_RELATION_RE.search(rest))

            # A field that is another model AND has @relation → skip (it's the navigation prop)
            if not is_scalar and has_relation:
                continue
            # A field that is another model without @relation → likely a forward-nav field, skip
            if not is_scalar and base_type not in known_enums:
                continue

            col_type = _PRISMA_TYPES.get(base_type, base_type.lower())
            pk       = "@id" in rest
            unique   = "@unique" in rest
            not_null = not is_opt

            default_m = re.search(r'@default\(([^)]+)\)', rest)
            default   = default_m.group(1) if default_m else None

            tables[model_name]["columns"].append({
                "name": col_name, "type": col_type,
                "pk": pk, "not_null": not_null, "unique": unique,
                "default": default, "note": None, "fk": False,
            })

    # ── Relations (second pass) ───────────────────────────────
    for m in _MODEL_RE.finditer(content):
        model_name = m.group(1)
        body       = m.group(2)

        for line in body.splitlines():
            line = line.strip()
            rel_m = _RELATION_RE.search(line)
            if not rel_m:
                continue
            fields     = [f.strip() for f in rel_m.group(1).split(",")]
            references = [r.strip() for r in rel_m.group(2).split(",")]

            # The type of the field on this line is the related model
            parts = line.split()
            if len(parts) < 2:
                continue
            related = parts[1].rstrip("?").rstrip("[]")

            for f, r in zip(fields, references):
                refs.append({
                    "from_table": model_name, "from_col": f,
                    "to_table":   related,    "to_col":   r,
                    "type": ">",
                })
                fk_set.add((model_name, f))

    # Mark FK columns
    for tbl in tables.values():
        for col in tbl["columns"]:
            col["fk"] = (tbl["full_name"], col["name"]) in fk_set

    groups = {name: [name] for name in tables}
    return {
        "tables": tables, "groups": groups, "enums": enums,
        "ungrouped": [], "refs": refs,
    }
