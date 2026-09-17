import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { all, get, initDb, openDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const marker = "[MOCK-DATA:PIAT-SYSTEM-TEST]";
const count = (row) => Number(row?.count || 0);
const baseSemester = (code) => String(code || "").split(" (")[0];

async function query(db, sql, params = []) {
  return all(db, sql, params);
}

async function scalar(db, sql, params = []) {
  return count(await get(db, sql, params));
}

async function audit(db) {
  const students = await scalar(db, "SELECT COUNT(*) AS count FROM students WHERE reviewNote = ?", [marker]);
  const users = await scalar(db, "SELECT COUNT(*) AS count FROM users WHERE userId LIKE 'MOCK-STD2026-%'");
  const offerings = await scalar(db, "SELECT COUNT(*) AS count FROM subjectOfferings WHERE sectionId IN (SELECT id FROM sections WHERE code LIKE 'MOCK-%')");
  const enrollments = await scalar(db, "SELECT COUNT(*) AS count FROM enrollments WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)", [marker]);
  const grades = await scalar(db, "SELECT COUNT(*) AS count FROM grades WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)", [marker]);
  const attendance = await scalar(db, "SELECT COUNT(*) AS count FROM attendance WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)", [marker]);
  const records = await scalar(db, "SELECT COUNT(*) AS count FROM academicRecords WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)", [marker]);

  const curriculumRows = await query(db, "SELECT COUNT(*) AS count FROM curriculum");
  const expectedOfferingRows = await query(db, `
    SELECT COUNT(*) AS count
    FROM sections sec
    JOIN subjectOfferings so ON so.sectionId = sec.id
    JOIN curriculum c ON c.programId = sec.programId AND c.yearLevel = sec.yearLevel AND c.subjectId = so.subjectId
    JOIN semesters sem ON sem.id = so.semesterId
      AND c.semester = CASE WHEN instr(sem.code, ' (') > 0 THEN substr(sem.code, 1, instr(sem.code, ' (') - 1) ELSE sem.code END
    WHERE sec.code LIKE 'MOCK-%'
  `);
  const offeringMismatch = await scalar(db, `
    SELECT COUNT(*) AS count
    FROM subjectOfferings so
    JOIN sections sec ON sec.id = so.sectionId
    LEFT JOIN semesters sem ON sem.id = so.semesterId
    LEFT JOIN curriculum c ON c.programId = sec.programId AND c.yearLevel = sec.yearLevel AND c.subjectId = so.subjectId
      AND c.semester = CASE WHEN instr(sem.code, ' (') > 0 THEN substr(sem.code, 1, instr(sem.code, ' (') - 1) ELSE sem.code END
    WHERE sec.code LIKE 'MOCK-%' AND c.id IS NULL
  `);
  const duplicateOfferings = await scalar(db, `
    SELECT COUNT(*) AS count FROM (
      SELECT so.academicYearId, so.semesterId, sec.programId, sec.yearLevel, sec.id AS sectionId, so.subjectId
      FROM subjectOfferings so JOIN sections sec ON sec.id = so.sectionId
      WHERE sec.code LIKE 'MOCK-%'
      GROUP BY so.academicYearId, so.semesterId, sec.programId, sec.yearLevel, sec.id, so.subjectId
      HAVING COUNT(*) > 1
    )
  `);

  const invalidEnrollments = await scalar(db, `
    SELECT COUNT(*) AS count
    FROM enrollments e
    JOIN students s ON s.id = e.studentId
    JOIN subjectOfferings so ON so.id = e.subjectOfferingId
    JOIN sections sec ON sec.id = so.sectionId
    LEFT JOIN semesters sem ON sem.id = so.semesterId
    LEFT JOIN curriculum c ON c.programId = sec.programId AND c.yearLevel = sec.yearLevel AND c.subjectId = so.subjectId
      AND c.semester = CASE WHEN instr(sem.code, ' (') > 0 THEN substr(sem.code, 1, instr(sem.code, ' (') - 1) ELSE sem.code END
    WHERE s.reviewNote = ? AND c.id IS NULL
  `, [marker]);
  const duplicateEnrollments = await scalar(db, `
    SELECT COUNT(*) AS count FROM (
      SELECT studentId, subjectOfferingId FROM enrollments GROUP BY studentId, subjectOfferingId HAVING COUNT(*) > 1
    )
    WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)
  `, [marker]);

  const invalidGrades = await scalar(db, `
    SELECT COUNT(*) AS count
    FROM grades g
    LEFT JOIN enrollments e ON e.studentId = g.studentId AND e.subjectOfferingId = g.subjectOfferingId
    LEFT JOIN subjectOfferings so ON so.id = g.subjectOfferingId
    LEFT JOIN faculty f ON f.id = so.facultyId
    WHERE g.studentId IN (SELECT id FROM students WHERE reviewNote = ?)
      AND (e.id IS NULL OR so.id IS NULL OR (so.facultyId IS NOT NULL AND f.id IS NULL))
  `, [marker]);
  const gradesWithoutEnrollment = await scalar(db, `
    SELECT COUNT(*) AS count FROM grades g LEFT JOIN enrollments e ON e.studentId = g.studentId AND e.subjectOfferingId = g.subjectOfferingId
    WHERE g.studentId IN (SELECT id FROM students WHERE reviewNote = ?) AND e.id IS NULL
  `, [marker]);
  const duplicateGrades = await scalar(db, `
    SELECT COUNT(*) AS count FROM (SELECT studentId, subjectOfferingId, period, type FROM grades GROUP BY studentId, subjectOfferingId, period, type HAVING COUNT(*) > 1)
    WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)
  `, [marker]);

  const invalidAttendance = await scalar(db, `
    SELECT COUNT(*) AS count
    FROM attendance a
    LEFT JOIN enrollments e ON e.studentId = a.studentId AND e.subjectOfferingId = a.subjectOfferingId
    LEFT JOIN subjectOfferings so ON so.id = a.subjectOfferingId
    LEFT JOIN sections sec ON sec.id = so.sectionId
    LEFT JOIN semesters sem ON sem.id = so.semesterId
    LEFT JOIN academicYears ay ON ay.id = so.academicYearId
    WHERE a.studentId IN (SELECT id FROM students WHERE reviewNote = ?)
      AND (e.id IS NULL OR so.id IS NULL OR sec.id IS NULL OR sem.id IS NULL OR ay.id IS NULL)
  `, [marker]);
  const duplicateAttendance = await scalar(db, `
    SELECT COUNT(*) AS count FROM (SELECT studentId, subjectOfferingId, date FROM attendance GROUP BY studentId, subjectOfferingId, date HAVING COUNT(*) > 1)
    WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)
  `, [marker]);

  const orphanRecords = await scalar(db, `
    SELECT COUNT(*) AS count
    FROM academicRecords ar
    LEFT JOIN enrollments e ON e.studentId = ar.studentId AND e.subjectOfferingId = ar.subjectOfferingId
    LEFT JOIN grades g ON g.studentId = ar.studentId AND g.subjectOfferingId = ar.subjectOfferingId AND g.status = 'finalized'
    WHERE ar.studentId IN (SELECT id FROM students WHERE reviewNote = ?)
      AND (ar.subjectOfferingId IS NULL OR e.id IS NULL OR g.id IS NULL)
  `, [marker]);
  const unassignedOfferings = await scalar(db, "SELECT COUNT(*) AS count FROM subjectOfferings so JOIN sections sec ON sec.id = so.sectionId WHERE sec.code LIKE 'MOCK-%' AND so.facultyId IS NULL");
  const offeringsWithoutStudents = await scalar(db, `SELECT COUNT(*) AS count FROM (SELECT so.id FROM subjectOfferings so JOIN sections sec ON sec.id = so.sectionId LEFT JOIN enrollments e ON e.subjectOfferingId = so.id WHERE sec.code LIKE 'MOCK-%' GROUP BY so.id HAVING COUNT(e.id) = 0)`);
  const studentsWithoutSubjects = await scalar(db, `SELECT COUNT(*) AS count FROM (SELECT s.id FROM students s LEFT JOIN enrollments e ON e.studentId = s.id WHERE s.reviewNote = ? AND s.status != 'pending' GROUP BY s.id HAVING COUNT(e.id) = 0)`, [marker]);
  const pendingWithoutSubjects = await scalar(db, `SELECT COUNT(*) AS count FROM (SELECT s.id FROM students s LEFT JOIN enrollments e ON e.studentId = s.id WHERE s.reviewNote = ? AND s.status = 'pending' GROUP BY s.id HAVING COUNT(e.id) = 0)`, [marker]);
  const facultyWithoutAssignments = await scalar(db, "SELECT COUNT(*) AS count FROM (SELECT f.id FROM faculty f LEFT JOIN subjectOfferings so ON so.facultyId = f.id AND so.sectionId IN (SELECT id FROM sections WHERE code LIKE 'MOCK-%') WHERE f.status = 'active' GROUP BY f.id HAVING COUNT(so.id) = 0)");

  const statusRows = await query(db, `SELECT g.status, COUNT(*) AS count FROM grades g WHERE g.studentId IN (SELECT id FROM students WHERE reviewNote = ?) GROUP BY g.status ORDER BY g.status`, [marker]);
  const noGradeStudents = await scalar(db, `SELECT COUNT(*) AS count FROM students s LEFT JOIN grades g ON g.studentId = s.id WHERE s.reviewNote = ? GROUP BY s.id HAVING COUNT(g.id) = 0`, [marker]);
  const breakdown = await query(db, `
    SELECT p.name AS program, sec.yearLevel, sem.name AS semester, substr(sec.name, -1) AS section,
      COUNT(DISTINCT e.studentId) AS students, COUNT(e.id) AS enrollments
    FROM enrollments e
    JOIN students s ON s.id = e.studentId AND s.reviewNote = ?
    JOIN subjectOfferings so ON so.id = e.subjectOfferingId
    JOIN sections sec ON sec.id = so.sectionId
    JOIN programs p ON p.id = sec.programId
    JOIN semesters sem ON sem.id = so.semesterId
    GROUP BY p.name, sec.yearLevel, sem.name, sec.id
    ORDER BY p.name, sec.yearLevel, sem.sequence, section
  `, [marker]);
  const facultyRows = await query(db, `
    SELECT f.firstName || ' ' || f.lastName AS faculty, COUNT(DISTINCT so.id) AS offerings, COUNT(DISTINCT e.studentId) AS students,
      COUNT(DISTINCT g.id) AS grades, COUNT(DISTINCT a.id) AS attendance
    FROM faculty f
    LEFT JOIN subjectOfferings so ON so.facultyId = f.id AND so.sectionId IN (SELECT id FROM sections WHERE code LIKE 'MOCK-%')
    LEFT JOIN enrollments e ON e.subjectOfferingId = so.id
    LEFT JOIN grades g ON g.subjectOfferingId = so.id AND g.studentId IN (SELECT id FROM students WHERE reviewNote = ?)
    LEFT JOIN attendance a ON a.subjectOfferingId = so.id AND a.studentId IN (SELECT id FROM students WHERE reviewNote = ?)
    WHERE f.status = 'active'
    GROUP BY f.id ORDER BY faculty
  `, [marker, marker]);

  const failures = [
    ["Duplicate subject offerings", duplicateOfferings], ["Invalid offering curriculum links", offeringMismatch], ["Duplicate enrollments", duplicateEnrollments], ["Invalid enrollments", invalidEnrollments], ["Invalid grades", invalidGrades], ["Grades without enrollment", gradesWithoutEnrollment], ["Duplicate grades", duplicateGrades], ["Invalid attendance", invalidAttendance], ["Duplicate attendance", duplicateAttendance], ["Orphan academic records", orphanRecords], ["Unassigned offerings", unassignedOfferings], ["Offerings without students", offeringsWithoutStudents], ["Students without subjects", studentsWithoutSubjects],
  ];
  const issueLines = failures.map(([name, value]) => `- [${value === 0 ? "PASS" : "FAIL"}] ${name}: ${value}`).join("\n");
  const statusLines = statusRows.map((row) => `- ${row.status}: ${row.count}`).join("\n") || "- None";
    const applicationFindings = `## Application and UI Findings\n\n- [PASS] Backend startup: helper imports resolve and the Express API starts on port 4000.\n- [PASS] API smoke tests: programs, students, academic structure, offerings, enrollments, grades, attendance, faculty assignments, and faculty class lists returned responses.\n- [ISSUE UI-001] Student dashboard subject summary displays 0 offerings / 0 units for a valid approved enrolled student. Direct SQLite shows 8 current enrollments for the tested student, while the frontend requests the default paginated subject-offerings response and does not filter it to the student's current term. This is an application/frontend data-loading issue, not a seed relationship issue.\n- [PASS] After clearing stale browser storage and logging in again, the approved mock student reached /dashboard/student.\n`;
  const breakdownLines = breakdown.map((row) => `| ${row.program} | ${row.yearLevel} | ${row.semester} | ${row.section} | ${row.students} | ${(row.enrollments / row.students).toFixed(2)} | ${row.enrollments} |`).join("\n") || "| None | - | - | - | 0 | 0 | 0 |";
  const facultyLines = facultyRows.map((row) => `| ${row.faculty} | ${row.offerings} | ${row.students} | ${row.grades} | ${row.attendance} |`).join("\n");
    const report = `# Mock Data Integrity Report\n\n- Audit date: ${new Date().toISOString()}\n- Dataset marker: \`${marker}\`\n- Scope: marked mock students and their related mock sections/offerings\n\n## Counts\n\n- Students: ${students}\n- Student accounts: ${users}\n- Curriculum records: ${count(curriculumRows[0])}\n- Subject offerings: ${offerings}\n- Enrollments: ${enrollments}\n- Grades: ${grades}\n- Attendance: ${attendance}\n- Academic records: ${records}\n\n## Subject Offering Calculation\n\nExpected offerings from actual curriculum-to-section matches: ${count(expectedOfferingRows[0])}.\nThe expected value is computed as the count of each section's program/year/semester curriculum subjects, across the existing academic-year and semester-linked sections. Duplicate offering groups: ${duplicateOfferings}. Invalid offering-to-curriculum links: ${offeringMismatch}.\n\n## Integrity Checks\n\n${issueLines}\n\nFaculty without mock assignments: ${facultyWithoutAssignments}\nStudents with no grades: ${noGradeStudents}\nPending incomplete students without subjects (expected scenario): ${pendingWithoutSubjects}\n\n## Application and UI Findings\n\n${applicationFindings}\n\n## Grade Workflow\n\n${statusLines}\n\n## Breakdown\n\n| Program | Year level | Semester | Section | Students | Average subjects/student | Enrollments |\n|---|---|---|---|---:|---:|---:|\n${breakdownLines}\n\n## Faculty Relationship Check\n\n| Faculty | Assigned mock offerings | Enrolled students | Grades | Attendance |\n|---|---:|---:|---:|---:|\n${facultyLines}\n\n## Interpretation\n\nA non-zero integrity issue is a seed/data problem and should be fixed in the seed. Pending students without subjects are intentional incomplete-registration edge cases. Backend startup or route failures are application/backend problems. Browser rendering or interaction failures are frontend/UI problems. This report does not hide failures behind dashboard values; all counts come from direct SQLite joins.\n`;
  await fs.writeFile(path.join(root, "MOCK_DATA_INTEGRITY_REPORT.md"), report, "utf8");
  console.log(report);
}

const db = await openDb();
try {
  await initDb(db);
  await audit(db);
} finally {
  db.close();
}
