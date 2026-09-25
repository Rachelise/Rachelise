import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Model = require("../src/degree-model.js");
const requirements = require("../src/requirements.js");
const { courses } = require("../data/courses.json");
const { toCourse } = await import("../scripts/sync-notion.mjs");

const course = (over) => ({
  id: "x", name: "Course", code: "ABCD 3000", category: "Major Core", status: "Completed",
  grade: "A", credits: 3, requirement: null, term: "Fall 2026", prereqMet: true, notes: "", url: "", ...over,
});

test("withdrawals, failed attempts, repeats and not-needed rows are excluded", () => {
  const { counted, excluded } = Model.partition([
    course({ code: "ENGL 1001", grade: "W", credits: 0, requirement: "Credit Not Contributing Toward Degree" }),
    course({ code: "MATH 110", grade: "F", credits: 0 }),
    course({ code: "MATH 099", grade: "B", credits: 4, requirement: "Credit Not Contributing Toward Degree" }),
    course({ code: "BLGY 231", grade: "C", credits: 0, requirement: "Duplicate/Repeated Course" }),
    course({ name: "[NOT NEEDED] Extra", code: "ADTA 4240", status: "Planned", grade: "N/A" }),
    course({ code: "ADTA 4340" }),
  ]);
  assert.deepEqual(counted.map((c) => c.code), ["ADTA 4340"]);
  assert.equal(excluded.length, 5);
});

test("duplicate rows count once and the copy with a Requirement wins", () => {
  const { counted, excluded } = Model.partition([
    course({ id: "a", code: "HIST 2620", term: "Spring 2026", requirement: null }),
    course({ id: "b", code: "HIST 2620", term: "Spring 2026", requirement: "American History: University Core — 6 hours" }),
  ]);
  assert.deepEqual(counted.map((c) => c.id), ["b"]);
  assert.equal(excluded[0].reason, "Duplicate row");
});

test("'Part I' prefix does not claim Part II or Part III courses", () => {
  assert.equal(Model.matchesPrefix("Applied Arts & Sciences Part I — Unifying Courses", "Applied Arts & Sciences Part I"), true);
  assert.equal(Model.matchesPrefix("Applied Arts & Sciences Part II — Professional Development", "Applied Arts & Sciences Part I"), false);
  assert.equal(Model.matchesPrefix("Applied Arts & Sciences Part III — Occupational", "Applied Arts & Sciences Part I"), false);
});

test("hours beyond a block's need spill into electives", () => {
  const { blocks, electives } = Model.assignBlocks(
    [
      course({ code: "PSYC 201", requirement: "Social & Behavioral Science: University Core" }),
      course({ code: "SLGY 201", requirement: "Social & Behavioral Science: University Core" }),
    ],
    requirements,
  );
  const sbs = blocks.find((b) => b.id === "sbs");
  assert.equal(sbs.completed, 3);
  assert.equal(sbs.state, "done");
  assert.equal(electives.completed, 3);
});

test("course level reads the first 4-digit course number", () => {
  assert.equal(Model.courseLevel("ADTA 4340"), 4);
  assert.equal(Model.courseLevel("PSCI 2306 or 2316"), 2);
  assert.equal(Model.courseLevel("ENGL 101"), 1);
  assert.equal(Model.courseLevel("Multiple options"), 1);
});

test("GPA ignores pass/fail and in-progress grades", () => {
  const r = Model.gpa([
    course({ grade: "A" }),
    course({ grade: "B" }),
    course({ grade: "P (Pass)" }),
    course({ grade: "IP", status: "In Progress" }),
  ]);
  assert.equal(r.hours, 6);
  assert.equal(r.gpa, 3.5);
});

test("projection starts the term after the current one and skips summers by default", () => {
  const terms = Model.projectTerms(20, 9, false, { season: "Fall", year: 2026 });
  assert.deepEqual(terms.map((t) => t.label), ["Spring 2027", "Fall 2027", "Spring 2028"]);
  assert.deepEqual(terms.map((t) => t.hours), [9, 9, 2]);
  const withSummer = Model.projectTerms(20, 9, true, { season: "Spring", year: 2027 });
  assert.deepEqual(withSummer.map((t) => t.label), ["Summer 2027", "Fall 2027", "Spring 2028"]);
});

test("Notion snapshot: current degree totals", () => {
  const { summary, electives } = Model.summarize(courses, requirements, { hoursPerTerm: 12 });
  assert.equal(summary.completed, 57);
  assert.equal(summary.inProgress, 6);
  assert.equal(summary.planned, 54);
  assert.equal(summary.unassigned, 3);
  assert.equal(electives.unplanned, 3);
  assert.equal(summary.advanced.completed + summary.advanced.inProgress + summary.advanced.planned, 42);
  assert.equal(summary.gpa.unt.gpa.toFixed(2), "3.67");
  assert.equal(summary.currentTerm, "Fall 2026");
  assert.equal(summary.graduationTerm, "Spring 2029");
});

test("sync maps a Notion API page to a course", () => {
  const rt = (t) => [{ plain_text: t }];
  const c = toCourse({
    id: "3bacdaf2-2502-8151-b7fc-dbaee29019c9",
    url: "https://www.notion.so/x",
    properties: {
      "Course Name": { type: "title", title: rt("BAAS 3020 — Fundamentals") },
      "Course Code": { type: "rich_text", rich_text: rt("BAAS 3020") },
      Category: { type: "select", select: { name: "Major Core" } },
      Status: { type: "select", select: { name: "In Progress" } },
      Grade: { type: "select", select: { name: "IP" } },
      Credits: { type: "number", number: 3 },
      Requirement: { type: "rich_text", rich_text: [] },
      "Semester Taken": { type: "rich_text", rich_text: rt("Fall 2026 (8W1)") },
      "Prerequisite Met": { type: "checkbox", checkbox: false },
      Notes: { type: "rich_text", rich_text: [] },
    },
  });
  assert.equal(c.id, "3bacdaf225028151b7fcdbaee29019c9");
  assert.equal(c.code, "BAAS 3020");
  assert.equal(c.requirement, null);
  assert.equal(c.credits, 3);
  assert.equal(c.term, "Fall 2026 (8W1)");
});
