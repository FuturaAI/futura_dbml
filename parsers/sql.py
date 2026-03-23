"""SQL CREATE TABLE parser — uses sqlglot for multi-dialect support."""
import sqlglot
import sqlglot.expressions as E


def parse_sql(content: str) -> dict:
    tables: dict[str, dict] = {}
    refs:   list[dict]      = []
    fk_set: set[tuple]      = set()

    for stmt in sqlglot.parse(content, error_level=sqlglot.ErrorLevel.WARN):
        if not isinstance(stmt, E.Create):
            continue
        if (stmt.args.get("kind") or "").upper() != "TABLE":
            continue

        tbl_expr = stmt.find(E.Table)
        if not tbl_expr:
            continue

        db_part  = tbl_expr.args.get("db")
        schema   = db_part.name if db_part else ""
        tbl_name = tbl_expr.name
        full_name = f"{schema}.{tbl_name}" if schema else tbl_name

        tables[full_name] = {
            "name": tbl_name, "schema": schema,
            "full_name": full_name, "note": None, "columns": [],
        }

        schema_expr = stmt.find(E.Schema)
        if not schema_expr:
            continue

        for expr in schema_expr.expressions:

            # ── Column definition ────────────────────────────────────
            if isinstance(expr, E.ColumnDef):
                col_name = expr.name
                dt = expr.find(E.DataType)
                col_type = dt.sql() if dt else "varchar"

                pk = not_null = unique = False
                default = None

                for cc in expr.find_all(E.ColumnConstraint):
                    k = cc.find(E.ColumnConstraintKind)
                    if isinstance(k, E.PrimaryKeyColumnConstraint):
                        pk = not_null = True
                    elif isinstance(k, E.NotNullColumnConstraint):
                        not_null = True
                    elif isinstance(k, E.UniqueColumnConstraint):
                        unique = True
                    elif isinstance(k, E.DefaultColumnConstraint):
                        default = k.this.sql() if k.this else None
                    # Inline FK: col INTEGER REFERENCES other(id)
                    elif isinstance(k, E.Reference):
                        ref_tbl = k.find(E.Table)
                        ref_cols = k.find_all(E.Column)
                        if ref_tbl:
                            ref_col = next(ref_cols, None)
                            refs.append({
                                "from_table": full_name,
                                "from_col":   col_name,
                                "to_table":   ref_tbl.name,
                                "to_col":     ref_col.name if ref_col else "id",
                                "type":       ">",
                            })
                            fk_set.add((full_name, col_name))

                tables[full_name]["columns"].append({
                    "name": col_name, "type": col_type,
                    "pk": pk, "not_null": not_null, "unique": unique,
                    "default": default, "note": None, "fk": False,
                })

            # ── Table-level PRIMARY KEY ──────────────────────────────
            elif isinstance(expr, E.PrimaryKey):
                pk_cols = {c.name for c in expr.find_all(E.Column)}
                for col in tables[full_name]["columns"]:
                    if col["name"] in pk_cols:
                        col["pk"] = col["not_null"] = True

            # ── Table-level UNIQUE ───────────────────────────────────
            elif isinstance(expr, E.UniqueColumnConstraint):
                uq_cols = {c.name for c in expr.find_all(E.Column)}
                for col in tables[full_name]["columns"]:
                    if col["name"] in uq_cols:
                        col["unique"] = True

            # ── Table-level FOREIGN KEY ──────────────────────────────
            elif isinstance(expr, E.ForeignKey):
                fk_cols = [c.name for c in expr.find_all(E.Column)
                           if not any(isinstance(p, E.Reference) for p in c.parent_select()
                                      if False)]  # collect all cols from FK clause
                # simpler: first N cols before Reference
                ref_expr = expr.find(E.Reference)
                all_cols = list(expr.find_all(E.Column))
                if ref_expr:
                    ref_tbl  = ref_expr.find(E.Table)
                    ref_cols = list(ref_expr.find_all(E.Column))
                    src_cols = [c for c in all_cols if c not in ref_cols]
                    if ref_tbl:
                        for fc, rc in zip(src_cols, ref_cols):
                            refs.append({
                                "from_table": full_name, "from_col": fc.name,
                                "to_table":   ref_tbl.name, "to_col": rc.name,
                                "type": ">",
                            })
                            fk_set.add((full_name, fc.name))

    # Mark FK columns
    for full_name, tbl in tables.items():
        for col in tbl["columns"]:
            col["fk"] = (full_name, col["name"]) in fk_set

    groups = {name: [name] for name in tables}
    return {
        "tables": tables, "groups": groups, "enums": [],
        "ungrouped": [], "refs": refs,
    }
