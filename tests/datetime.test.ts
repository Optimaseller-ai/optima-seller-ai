const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");
const { DEFAULT_TIMEZONE, parseNaturalLanguageDateTime } = require("../src/lib/datetime");

const fixedNow = DateTime.fromISO("2026-04-27T15:00:00", { zone: DEFAULT_TIMEZONE });

test("demain à 8h", () => {
  const r = parseNaturalLanguageDateTime("demain à 8h", fixedNow);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.displayDate, "28/04/2026");
  assert.equal(r.value.displayTime, "08:00");
});

test("vendredi prochain 14h", () => {
  const r = parseNaturalLanguageDateTime("vendredi prochain 14h", fixedNow);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.displayDate, "01/05/2026");
  assert.equal(r.value.displayTime, "14:00");
});

test("ce soir", () => {
  const r = parseNaturalLanguageDateTime("ce soir", fixedNow);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.displayDate, "27/04/2026");
  assert.equal(r.value.displayTime, "20:00");
});

test("dans 3 jours", () => {
  const r = parseNaturalLanguageDateTime("dans 3 jours", fixedNow);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.displayDate, "30/04/2026");
  assert.equal(r.value.displayTime, "09:00");
});

test("lundi à 9h (when already past today)", () => {
  const r = parseNaturalLanguageDateTime("lundi à 9h", fixedNow);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.displayDate, "04/05/2026");
  assert.equal(r.value.displayTime, "09:00");
});
