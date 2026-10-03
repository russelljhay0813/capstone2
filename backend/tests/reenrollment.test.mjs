import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSemesterSequence,
  inferReenrollmentTarget,
} from "../enrollment/reenrollment.js";

test("semester labels resolve across database and curriculum naming conventions", () => {
  assert.equal(getSemesterSequence("First Semester"), 1);
  assert.equal(getSemesterSequence("1st Semester"), 1);
  assert.equal(getSemesterSequence("Second Semester"), 2);
  assert.equal(getSemesterSequence("2nd Semester"), 2);
  assert.equal(getSemesterSequence("Summer Term"), 3);
  assert.equal(getSemesterSequence("Unknown"), null);
});

test("re-enrollment advances from the database's First Semester label within the same year", () => {
  assert.deepEqual(
    inferReenrollmentTarget({
      academicYear: "2026-2027",
      yearLevel: "2nd Year",
      semester: "First Semester",
    }),
    {
      academicYear: "2026-2027",
      yearLevel: "2nd Year",
      semester: "2nd Semester",
    },
  );
});

test("re-enrollment advances the year level after the second semester", () => {
  assert.deepEqual(
    inferReenrollmentTarget({
      academicYear: "2026-2027",
      yearLevel: "2nd Year",
      semester: "Second Semester",
    }),
    {
      academicYear: "2027-2028",
      yearLevel: "3rd Year",
      semester: "1st Semester",
    },
  );
});
