"""Django and SQLAlchemy model parsers — Python AST based."""
import ast
import re

# ── Shared helpers ────────────────────────────────────────────────────────────

def _camel_to_snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _kwarg_bool(kwargs: dict, key: str) -> bool:
    node = kwargs.get(key)
    return isinstance(node, ast.Constant) and node.value is True


def _kwarg_str(kwargs: dict, key: str) -> str | None:
    node = kwargs.get(key)
    if isinstance(node, ast.Constant):
        return str(node.value)
    return None


# ── Django ────────────────────────────────────────────────────────────────────

_DJ_TYPES: dict[str, str | None] = {
    "AutoField": "integer",          "BigAutoField": "bigint",
    "SmallAutoField": "smallint",    "IntegerField": "integer",
    "BigIntegerField": "bigint",     "SmallIntegerField": "smallint",
    "PositiveIntegerField": "integer", "FloatField": "float",
    "DecimalField": "decimal",       "CharField": "varchar",
    "TextField": "text",             "EmailField": "varchar",
    "URLField": "varchar",           "SlugField": "varchar",
    "UUIDField": "uuid",             "BooleanField": "boolean",
    "NullBooleanField": "boolean",   "DateField": "date",
    "DateTimeField": "timestamp",    "TimeField": "time",
    "DurationField": "interval",     "BinaryField": "bytea",
    "JSONField": "json",             "FileField": "varchar",
    "ImageField": "varchar",         "GenericIPAddressField": "varchar",
    "ForeignKey": "integer",         "OneToOneField": "integer",
    "ManyToManyField": None,
}

_DJ_FK = {"ForeignKey", "OneToOneField"}
_DJ_M2M = {"ManyToManyField"}


def _is_django_model(node: ast.ClassDef) -> bool:
    for base in node.bases:
        if isinstance(base, ast.Attribute) and base.attr == "Model":
            return True
        if isinstance(base, ast.Name) and base.id == "Model":
            return True
    return False


def parse_django(content: str) -> dict:
    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        raise ValueError(f"Python syntax error: {e}") from e

    tables: dict[str, dict] = {}
    refs:   list[dict]      = []
    fk_set: set[tuple]      = set()

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef) or not _is_django_model(node):
            continue

        # Determine table name (Meta.db_table or snake_case of class name)
        tbl_name = _camel_to_snake(node.name)
        for item in ast.walk(node):
            if isinstance(item, ast.ClassDef) and item.name == "Meta":
                for stmt in item.body:
                    if isinstance(stmt, ast.Assign):
                        for t in stmt.targets:
                            if isinstance(t, ast.Name) and t.id == "db_table":
                                if isinstance(stmt.value, ast.Constant):
                                    tbl_name = stmt.value.value

        tables[tbl_name] = {
            "name": tbl_name, "schema": "", "full_name": tbl_name,
            "note": None, "columns": [],
        }

        # Implicit auto-pk
        has_explicit_pk = any(
            isinstance(stmt, ast.Assign)
            and isinstance(stmt.value, ast.Call)
            and _kwarg_bool({kw.arg: kw.value for kw in stmt.value.keywords if kw.arg}, "primary_key")
            for stmt in node.body
        )
        if not has_explicit_pk:
            tables[tbl_name]["columns"].append({
                "name": "id", "type": "integer",
                "pk": True, "not_null": True, "unique": True,
                "default": "autoincrement", "note": "Auto primary key", "fk": False,
            })

        for stmt in node.body:
            if not isinstance(stmt, ast.Assign):
                continue
            if len(stmt.targets) != 1 or not isinstance(stmt.targets[0], ast.Name):
                continue
            col_name = stmt.targets[0].id
            if col_name.startswith("_"):
                continue

            call = stmt.value
            if not isinstance(call, ast.Call):
                continue

            if isinstance(call.func, ast.Attribute):
                field_cls = call.func.attr
            elif isinstance(call.func, ast.Name):
                field_cls = call.func.id
            else:
                continue

            if field_cls in _DJ_M2M:
                continue
            col_type = _DJ_TYPES.get(field_cls, "varchar")
            if col_type is None:
                continue

            kwargs = {kw.arg: kw.value for kw in call.keywords if kw.arg}
            null     = _kwarg_bool(kwargs, "null")
            pk       = _kwarg_bool(kwargs, "primary_key")
            unique   = _kwarg_bool(kwargs, "unique") or field_cls == "OneToOneField"
            not_null = not null
            default  = _kwarg_str(kwargs, "default")

            if field_cls in _DJ_FK:
                # ForeignKey → col becomes col_id, ref → related model
                fk_col = col_name + "_id"
                ref_model = None
                if call.args:
                    a0 = call.args[0]
                    if isinstance(a0, ast.Name):
                        ref_model = a0.id
                    elif isinstance(a0, ast.Constant):
                        ref_model = str(a0.value).split(".")[-1]

                tables[tbl_name]["columns"].append({
                    "name": fk_col, "type": "integer",
                    "pk": pk, "not_null": not_null, "unique": unique,
                    "default": default, "note": None, "fk": True,
                })
                if ref_model:
                    ref_tbl = _camel_to_snake(ref_model)
                    refs.append({
                        "from_table": tbl_name, "from_col": fk_col,
                        "to_table":   ref_tbl,  "to_col":   "id",
                        "type": ">",
                    })
                    fk_set.add((tbl_name, fk_col))
            else:
                tables[tbl_name]["columns"].append({
                    "name": col_name, "type": col_type,
                    "pk": pk, "not_null": not_null, "unique": unique,
                    "default": default, "note": None, "fk": False,
                })

    groups = {name: [name] for name in tables}
    return {
        "tables": tables, "groups": groups, "enums": [],
        "ungrouped": [], "refs": refs,
    }


# ── SQLAlchemy ────────────────────────────────────────────────────────────────

_SA_TYPES: dict[str, str] = {
    "Integer": "integer",    "BigInteger": "bigint",   "SmallInteger": "smallint",
    "Float": "float",        "Numeric": "decimal",     "String": "varchar",
    "Text": "text",          "Boolean": "boolean",     "Date": "date",
    "DateTime": "timestamp", "Time": "time",            "LargeBinary": "bytea",
    "JSON": "json",          "UUID": "uuid",            "Uuid": "uuid",
    "VARCHAR": "varchar",    "CHAR": "char",            "INT": "integer",
    "BIGINT": "bigint",      "BOOLEAN": "boolean",      "TEXT": "text",
}


def _sa_type_name(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return _SA_TYPES.get(node.id, node.id.lower())
    if isinstance(node, ast.Call):
        func = node.func
        name = func.attr if isinstance(func, ast.Attribute) else (func.id if isinstance(func, ast.Name) else "")
        return _SA_TYPES.get(name, name.lower())
    if isinstance(node, ast.Attribute):
        return _SA_TYPES.get(node.attr, node.attr.lower())
    return "varchar"


def _is_sa_model(node: ast.ClassDef) -> bool:
    for base in node.bases:
        if isinstance(base, ast.Name) and ("Base" in base.id or base.id == "Model"):
            return True
        if isinstance(base, ast.Attribute) and base.attr in ("Base", "Model"):
            return True
        if isinstance(base, ast.Subscript):  # generic base like DeclarativeBase[...]
            return True
    return False


def parse_sqlalchemy(content: str) -> dict:
    try:
        tree = ast.parse(content)
    except SyntaxError as e:
        raise ValueError(f"Python syntax error: {e}") from e

    tables: dict[str, dict] = {}
    refs:   list[dict]      = []
    fk_set: set[tuple]      = set()

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef) or not _is_sa_model(node):
            continue

        # Find __tablename__
        tbl_name = node.name.lower()
        for stmt in node.body:
            if isinstance(stmt, ast.Assign):
                for t in stmt.targets:
                    if isinstance(t, ast.Name) and t.id == "__tablename__":
                        if isinstance(stmt.value, ast.Constant):
                            tbl_name = stmt.value.value

        tables[tbl_name] = {
            "name": tbl_name, "schema": "", "full_name": tbl_name,
            "note": None, "columns": [],
        }

        for stmt in node.body:
            if not isinstance(stmt, ast.Assign):
                continue
            if len(stmt.targets) != 1 or not isinstance(stmt.targets[0], ast.Name):
                continue
            col_name = stmt.targets[0].id
            if col_name.startswith("_") or col_name == "__tablename__":
                continue

            call = stmt.value
            if not isinstance(call, ast.Call):
                continue

            func_name = ""
            if isinstance(call.func, ast.Name):
                func_name = call.func.id
            elif isinstance(call.func, ast.Attribute):
                func_name = call.func.attr

            if func_name not in ("Column", "mapped_column"):
                continue
            if not call.args:
                continue

            col_type = _sa_type_name(call.args[0])
            kwargs   = {kw.arg: kw.value for kw in call.keywords if kw.arg}
            pk       = _kwarg_bool(kwargs, "primary_key")
            unique   = _kwarg_bool(kwargs, "unique")
            nullable = kwargs.get("nullable")
            not_null = pk or (isinstance(nullable, ast.Constant) and nullable.value is False)
            default  = _kwarg_str(kwargs, "default")

            # Scan args for ForeignKey(...)
            fk_ref: str | None = None
            for arg in call.args[1:]:
                if isinstance(arg, ast.Call):
                    fk_func = (arg.func.attr if isinstance(arg.func, ast.Attribute)
                               else arg.func.id if isinstance(arg.func, ast.Name) else "")
                    if fk_func == "ForeignKey" and arg.args:
                        if isinstance(arg.args[0], ast.Constant):
                            fk_ref = str(arg.args[0].value)

            tables[tbl_name]["columns"].append({
                "name": col_name, "type": col_type,
                "pk": pk, "not_null": not_null, "unique": unique,
                "default": default, "note": None, "fk": fk_ref is not None,
            })

            if fk_ref:
                parts = fk_ref.split(".")
                if len(parts) == 2:
                    ref_tbl, ref_col = parts
                    refs.append({
                        "from_table": tbl_name,  "from_col": col_name,
                        "to_table":   ref_tbl,   "to_col":   ref_col,
                        "type": ">",
                    })
                    fk_set.add((tbl_name, col_name))

    groups = {name: [name] for name in tables}
    return {
        "tables": tables, "groups": groups, "enums": [],
        "ungrouped": [], "refs": refs,
    }
