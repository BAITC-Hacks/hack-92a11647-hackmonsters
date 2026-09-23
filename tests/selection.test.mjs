import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planKey, selectionError } from "../src/lib/simulation.ts";

const read = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const data = read("../data/city.json");
const catalog = {
  dataset: {
    ...data,
    measures: data.measures.map(({ type, ...m }) => ({
      ...m,
      measure_type: type,
    })),
  },
  budget_limit: 100,
  required_decisions: 5,
  max_per_category: 2,
};
const official = read("../examples/official_request.json");

test("the official plan accepts two social measures and a missing direction", () => {
  assert.equal(selectionError(official, catalog), null);
});
test("a district is mandatory before selecting a district measure", () => {
  assert.match(
    selectionError({ measure_ids: ["M1"], district_assignments: {} }, catalog),
    /Выберите район/,
  );
});
test("city measures need no district", () => {
  assert.equal(
    selectionError({ measure_ids: ["M2"], district_assignments: {} }, catalog),
    null,
  );
});
test("global conflicts cannot be hidden by using different districts", () => {
  assert.match(
    selectionError(
      {
        measure_ids: ["M1", "M3"],
        district_assignments: { M1: "nura", M3: "esil" },
      },
      catalog,
    ),
    /несовместимы/,
  );
});
test("local conflicts apply only when district targets coincide", () => {
  const plan = {
    measure_ids: ["M4", "M7"],
    district_assignments: { M4: "nura", M7: "esil" },
  };
  assert.equal(selectionError(plan, catalog), null);
  plan.district_assignments.M7 = "nura";
  assert.match(selectionError(plan, catalog), /в одном районе/);
});
test("third measure in the same category is rejected", () => {
  assert.match(
    selectionError(
      {
        measure_ids: ["M7", "M8", "M9"],
        district_assignments: { M7: "nura", M8: "nura", M9: "esil" },
      },
      catalog,
    ),
    /не более 2/,
  );
});
test("budget overrun and sixth selection are rejected", () => {
  assert.match(
    selectionError(
      {
        measure_ids: ["M3", "M5", "M7", "M13"],
        district_assignments: {
          M3: "nura",
          M5: "esil",
          M7: "almaty",
          M13: "saryarka",
        },
      },
      catalog,
    ),
    /превышает бюджет/,
  );
  assert.match(
    selectionError(
      { ...official, measure_ids: [...official.measure_ids, "M2"] },
      catalog,
    ),
    /только 5/,
  );
});
test("district change invalidates analysis even with unchanged measure IDs", () => {
  const changed = structuredClone(official);
  changed.district_assignments.M7 = "esil";
  assert.notEqual(planKey(changed), planKey(official));
  const reordered = {
    measure_ids: [...official.measure_ids].reverse(),
    district_assignments: Object.fromEntries(
      Object.entries(official.district_assignments).reverse(),
    ),
  };
  assert.equal(planKey(reordered), planKey(official));
});
