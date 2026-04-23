from __future__ import annotations

import json
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any


class SchemaValidationError(ValueError):
    """Raised when a value does not satisfy the expected contract schema."""


SCHEMA_ROOT = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "contracts"
    / "schemas"
)


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _is_iso_datetime(value: str) -> bool:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False

    return True


@lru_cache(maxsize=None)
def load_schema(schema_name: str) -> dict[str, Any]:
    schema_path = SCHEMA_ROOT / f"{schema_name}.schema.json"
    return json.loads(schema_path.read_text(encoding="utf-8"))


def validate_schema(schema_name: str, value: Any) -> None:
    schema = load_schema(schema_name)
    _validate(schema, value, path="$")


def _validate(schema: dict[str, Any], value: Any, path: str) -> None:
    if "$ref" in schema:
        ref = schema["$ref"]
        if not isinstance(ref, str) or not ref.endswith(".schema.json"):
            raise SchemaValidationError(f"{path} uses unsupported schema reference: {ref}")
        ref_name = Path(ref).name.removesuffix(".schema.json")
        _validate(load_schema(ref_name), value, path)
        return

    if "oneOf" in schema:
        errors: list[str] = []

        for option in schema["oneOf"]:
            try:
                _validate(option, value, path)
                return
            except SchemaValidationError as error:
                errors.append(str(error))

        joined = "; ".join(errors)
        raise SchemaValidationError(f"{path} did not match any allowed schema: {joined}")

    schema_type = schema.get("type")

    if schema_type == "object":
        if not isinstance(value, dict):
            raise SchemaValidationError(f"{path} must be an object")

        required = schema.get("required", [])

        for key in required:
            if key not in value:
                raise SchemaValidationError(f"{path}.{key} is required")

        properties = schema.get("properties", {})
        additional_properties = schema.get("additionalProperties", True)

        for key, item in value.items():
            item_path = f"{path}.{key}"

            if key in properties:
                _validate(properties[key], item, item_path)
                continue

            if additional_properties is False:
                raise SchemaValidationError(f"{item_path} is not allowed")

            if isinstance(additional_properties, dict):
                _validate(additional_properties, item, item_path)

        return

    if schema_type == "array":
        if not isinstance(value, list):
            raise SchemaValidationError(f"{path} must be an array")

        item_schema = schema.get("items")

        if item_schema is not None:
            for index, item in enumerate(value):
                _validate(item_schema, item, f"{path}[{index}]")

        return

    if schema_type == "string":
        if not isinstance(value, str):
            raise SchemaValidationError(f"{path} must be a string")

        enum = schema.get("enum")
        if enum is not None and value not in enum:
            raise SchemaValidationError(f"{path} must be one of {enum}")

        value_format = schema.get("format")
        if value_format == "date-time" and not _is_iso_datetime(value):
            raise SchemaValidationError(f"{path} must be an ISO 8601 datetime")

        return

    if schema_type == "number":
        if not _is_number(value):
            raise SchemaValidationError(f"{path} must be a number")

        return

    if schema_type == "boolean":
        if not isinstance(value, bool):
            raise SchemaValidationError(f"{path} must be a boolean")

        return

    if schema_type == "null":
        if value is not None:
            raise SchemaValidationError(f"{path} must be null")

        return

    raise SchemaValidationError(f"{path} uses unsupported schema type: {schema_type}")
