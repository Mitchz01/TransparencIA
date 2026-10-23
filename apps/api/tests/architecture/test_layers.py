"""Hexagonal architecture dependency rule: adapters → application → domain."""

import ast
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[2] / "app"

INFRA = ("fastapi", "sqlmodel", "sqlalchemy", "google", "httpx", "sse_starlette", "starlette")

FORBIDDEN = {
    "domain": (*INFRA, "app.application", "app.adapters", "app.main", "app.config"),
    "application": (*INFRA, "app.adapters", "app.main", "app.config"),
}


def _imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.append(node.module)
    return names


@pytest.mark.parametrize("layer", FORBIDDEN)
def test_layer_does_not_import_outer_layers(layer: str):
    violations = [
        f"{path.relative_to(APP)} imports {name}"
        for path in (APP / layer).rglob("*.py")
        for name in _imports(path)
        if any(name == banned or name.startswith(banned + ".") for banned in FORBIDDEN[layer])
    ]
    assert not violations, "\n".join(violations)
