"""DBML parsing utilities."""
from pydbml import PyDBML


def parse_dbml(content: str) -> dict:
    parsed = PyDBML(content)

    # ── tables ───────────────────────────────────────────────────────────────
    tables: dict[str, dict] = {}
    for tbl in parsed.tables:
        schema    = tbl.schema or ""
        full_name = f"{schema}.{tbl.name}" if schema else tbl.name
        tables[full_name] = {
            "name":      tbl.name,
            "schema":    schema,
            "full_name": full_name,
            "note":      tbl.note.text if tbl.note else None,
            "columns":   [],
        }
        for col in tbl.columns:
            tables[full_name]["columns"].append({
                "name":     col.name,
                "type":     str(col.type),
                "pk":       col.pk,
                "not_null": col.not_null,
                "unique":   col.unique,
                "default":  str(col.default) if col.default is not None else None,
                "note":     col.note.text if col.note else None,
                "fk":       False,   # filled in below
            })

    # ── groups ───────────────────────────────────────────────────────────────
    groups: dict[str, list[str]] = {}
    assigned: set[str] = set()
    for grp in parsed.table_groups:
        names: list[str] = []
        for item in grp.items:
            schema    = getattr(item, "schema", None) or ""
            full_name = f"{schema}.{item.name}" if schema else item.name
            names.append(full_name)
            assigned.add(full_name)
        groups[grp.name] = names

    ungrouped = [n for n in tables if n not in assigned]

    # ── refs & FK annotation ─────────────────────────────────────────────────
    refs: list[dict] = []
    fk_set: set[tuple[str, str]] = set()

    for ref in parsed.refs:
        for c1, c2 in zip(ref.col1, ref.col2):
            s1         = getattr(c1.table, "schema", None) or ""
            s2         = getattr(c2.table, "schema", None) or ""
            from_table = f"{s1}.{c1.table.name}" if s1 else c1.table.name
            to_table   = f"{s2}.{c2.table.name}" if s2 else c2.table.name

            refs.append({
                "from_table": from_table,
                "from_col":   c1.name,
                "to_table":   to_table,
                "to_col":     c2.name,
                "type":       ref.type,
            })

            if ref.type == ">":
                fk_set.add((from_table, c1.name))
            elif ref.type == "<":
                fk_set.add((to_table, c2.name))
            else:
                fk_set.add((from_table, c1.name))
                fk_set.add((to_table,   c2.name))

    for full_name, tbl in tables.items():
        for col in tbl["columns"]:
            col["fk"] = (full_name, col["name"]) in fk_set

    # ── enums ─────────────────────────────────────────────────────────────────
    enums: list[dict] = []
    for enum in getattr(parsed, "enums", []):
        schema    = getattr(enum, "schema", None) or ""
        full_name = f"{schema}.{enum.name}" if schema else enum.name
        enums.append({
            "name":      enum.name,
            "schema":    schema,
            "full_name": full_name,
            "values":    [item.name for item in enum.items],
        })

    return {
        "tables":    tables,
        "groups":    groups,
        "ungrouped": ungrouped,
        "refs":      refs,
        "enums":     enums,
    }
