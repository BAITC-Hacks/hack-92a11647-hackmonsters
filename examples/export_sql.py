"""Render a fresh-database PostgreSQL seed from the validated canonical JSON."""

import json
from pathlib import Path
from typing import Any

from city_simulator import METRICS, CitySimulator, Dataset, ScoringRules


def literal(value: Any) -> str:
    """Quote SQL literals, doubling apostrophes; structured values use JSONB."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (dict, list)):
        return literal(json.dumps(value, ensure_ascii=False)) + "::jsonb"
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return str(value)


def render_sql(dataset: Dataset, rules: ScoringRules) -> str:
    """Return transactional DDL and seed data; never connect to or overwrite a DB."""
    catalog = CitySimulator(dataset, rules).catalog()
    source = catalog["dataset"]
    metric_columns = ",\n".join(
        f"    {metric.lower()} DOUBLE PRECISION NOT NULL CHECK ({metric.lower()} BETWEEN 0 AND 100)"
        for metric in METRICS
    )
    statements = [
        "BEGIN;",
        "CREATE TABLE districts (\n"
        "    id VARCHAR(32) PRIMARY KEY,\n"
        "    name VARCHAR(100) NOT NULL UNIQUE,\n"
        "    population_share DOUBLE PRECISION NOT NULL CHECK (population_share > 0 AND population_share <= 1),\n"
        + metric_columns + ",\n"
        "    base_d NUMERIC(5, 2) CHECK (base_d BETWEEN 0 AND 100)\n);",
        "CREATE TABLE measures (\n"
        "    id VARCHAR(32) PRIMARY KEY,\n"
        "    category VARCHAR(100) NOT NULL,\n"
        "    name VARCHAR(255) NOT NULL,\n"
        "    measure_type VARCHAR(8) NOT NULL CHECK (measure_type IN ('District', 'City')),\n"
        "    cost INT NOT NULL CHECK (cost >= 0),\n"
        "    lag INT NOT NULL CHECK (lag BETWEEN 0 AND 8),\n"
        "    effects JSONB NOT NULL CHECK (jsonb_typeof(effects) = 'object')\n);",
        "CREATE TABLE synergies (\n"
        "    pair JSONB PRIMARY KEY CHECK (jsonb_typeof(pair) = 'array' AND jsonb_array_length(pair) = 2),\n"
        "    bonus JSONB NOT NULL,\n"
        "    target JSONB NOT NULL,\n"
        "    lag_scaled BOOLEAN NOT NULL\n);",
        "CREATE TABLE conflicts (\n"
        "    pair JSONB PRIMARY KEY CHECK (jsonb_typeof(pair) = 'array' AND jsonb_array_length(pair) = 2),\n"
        "    scope VARCHAR(32) NOT NULL CHECK (scope IN ('global', 'same_district'))\n);",
        "CREATE TABLE scoring_rules (\n"
        "    version VARCHAR(100) PRIMARY KEY,\n"
        "    parameters JSONB NOT NULL\n);",
    ]
    district_columns = ["id", "name", "population_share", *[metric.lower() for metric in METRICS], "base_d"]
    for district in source["districts"]:
        values = [district["id"], district["name"], district["population_share"],
                  *[district["metrics"][metric] for metric in METRICS], district["base_d"]]
        statements.append(f"INSERT INTO districts ({', '.join(district_columns)}) VALUES ({', '.join(map(literal, values))});")
    for table, columns in (
        ("measures", ["id", "category", "name", "measure_type", "cost", "lag", "effects"]),
        ("synergies", ["pair", "bonus", "target", "lag_scaled"]),
        ("conflicts", ["pair", "scope"]),
    ):
        for record in source[table]:
            values = ", ".join(literal(record[column]) for column in columns)
            statements.append(f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({values});")
    statements.append(f"INSERT INTO scoring_rules (version, parameters) VALUES ({literal(rules.version)}, {literal(catalog['methodology'])});")
    return "\n\n".join([*statements, "COMMIT;"]) + "\n"


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    print(render_sql(Dataset.from_json(root / "data/city.json"),
                     ScoringRules.model_validate_json((root / "data/rules.json").read_text(encoding="utf-8"))), end="")
