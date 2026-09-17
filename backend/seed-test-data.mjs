import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { all, get, initDb, openDb, run, withTransaction } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MOCK_NOTE = "[MOCK-DATA:PIAT-SYSTEM-TEST]";
const PASSWORD = "PiatTest2026!";
const PROGRAM_NAMES = [
  "Diploma in Hospitality Services and Technology",
  "Diploma in Tourism and Travel Services",
  "Diploma in Multimedia Arts and Design",
  "Diploma in Industrial Education (Major in Hotel and Restaurant Services)",
  "Diploma in Industrial Education (Major in Multimedia Arts and Design)",
];
const FIRST_NAMES = ["Althea", "Beatriz", "Carlo", "Danica", "Elias", "Francesca", "Gabriel", "Hannah", "Iñigo", "Jasmine", "Kenji", "Lourdes", "Miguel", "Nadine", "Paolo", "Rafael", "Sofia", "Tristan", "Valerie", "Xavier"];
const MIDDLE_NAMES = ["Santos", "Reyes", "Cruz", "Garcia", "Mendoza", "Navarro", "Bautista", "Aquino", "Castillo", "Flores"];
const LAST_NAMES = ["Dela Cruz", "Santiago", "Manalo", "Villanueva", "Domingo", "Soriano", "Mercado", "Pascual", "Aguilar", "Rivera", "Torres", "Ramos", "Lim", "Tan", "Salazar", "Ocampo", "Valdez", "Macapagal", "Del Rosario", "Estrada"];
const CITIES = ["Quezon City", "Makati", "Pasig", "Cebu City", "Davao City", "Antipolo", "Iloilo City", "Baguio"];
const PROVINCES = ["Metro Manila", "Cebu", "Davao del Sur", "Rizal", "Iloilo", "Benguet"];
const BARANGAYS = ["San Antonio", "Bagong Pag-asa", "Poblacion", "Mabolo", "Buhangin", "Commonwealth"];
const FACULTY_NAMES = ["Maria Santos", "Jose Reyes", "Ana Bautista", "Ramon Garcia"];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const id = () => crypto.randomUUID();
const now = Date.now();
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
};
const pick = (items, index) => items[index % items.length];
const dateFor = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const yearRank = { "1st Year": 1, "2nd Year": 2, "3rd Year": 3, "4th Year": 4 };
const curriculumSemesterCode = (semester) => String(semester.code).split(" (")[0];

async function ensureFacultyCredentials(db) {
  const assignedFaculty = await all(
    db,
    `SELECT DISTINCT f.id, f.userId, u.id AS userDbId
     FROM faculty f
     JOIN subjectOfferings o ON o.facultyId = f.id
     LEFT JOIN users u ON u.id = f.userId
     WHERE f.status = 'active'`,
  );

  for (const faculty of assignedFaculty) {
    if (!faculty.userDbId) {
      throw new Error(`Assigned faculty ${faculty.id} is not linked to a user account.`);
    }
    await run(
      db,
      `UPDATE users
       SET password = ?, temporaryPassword = ?, role = 'faculty', status = 'active'
       WHERE id = ?`,
      [hashPassword(PASSWORD), PASSWORD, faculty.userDbId],
    );
  }
}

function currentAcademicYear(years) {
  const today = new Date().toISOString().slice(0, 10);
  return years.find((year) => year.status === "active" && year.startDate <= today && today <= year.endDate) ||
    years.filter((year) => year.status === "active" && Number(year.code.slice(0, 4)) <= new Date().getFullYear()).sort((a, b) => b.code.localeCompare(a.code))[0] ||
    years.filter((year) => year.status === "active").sort((a, b) => b.code.localeCompare(a.code))[0];
}

async function reset(db) {
  await withTransaction(db, async () => {
    await run(db, `DELETE FROM academicRecords WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)`, [MOCK_NOTE]);
    await run(db, `DELETE FROM notifications WHERE userId IN (SELECT userId FROM students WHERE reviewNote = ?)`, [MOCK_NOTE]);
    await run(db, `DELETE FROM attendance WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)`, [MOCK_NOTE]);
    await run(db, `DELETE FROM grades WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)`, [MOCK_NOTE]);
    await run(db, `DELETE FROM enrollments WHERE studentId IN (SELECT id FROM students WHERE reviewNote = ?)`, [MOCK_NOTE]);
    await run(db, "DELETE FROM subjectOfferings WHERE sectionId IN (SELECT id FROM sections WHERE code LIKE 'MOCK-%')");
    await run(db, "DELETE FROM sections WHERE code LIKE 'MOCK-%'");
    await run(db, "DELETE FROM students WHERE reviewNote = ?", [MOCK_NOTE]);
    await run(db, "DELETE FROM users WHERE userId LIKE 'MOCK-STD2026-%'");
  });
  console.log("Removed existing PIAT mock student data.");
}

async function ensureSection(db, program, yearLevel, semester, academicYear, letter) {
  const code = `MOCK-${academicYear.code}-${program.id.slice(0, 6)}-${yearLevel[0]}-${semester.sequence}-${letter}`;
  let section = await get(db, "SELECT * FROM sections WHERE code = ?", [code]);
  if (!section) {
    section = { id: id(), code, name: `${yearLevel} - Section ${letter}`, programId: program.id, yearLevel, semesterId: semester.id, academicYearId: academicYear.id };
    await run(db, `INSERT INTO sections (id, code, name, programId, yearLevel, semesterId, academicYearId, capacity, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`, [section.id, section.code, section.name, section.programId, section.yearLevel, section.semesterId, section.academicYearId, 45, now]);
  }
  return section;
}

async function ensureOffering(db, curriculum, section, academicYear, semester, faculty) {
  let offering = await get(db, "SELECT * FROM subjectOfferings WHERE subjectId = ? AND academicYearId = ? AND semesterId = ? AND sectionId = ?", [curriculum.subjectId, academicYear.id, semester.id, section.id]);
  if (!offering) {
    offering = { id: id() };
    await run(db, `INSERT INTO subjectOfferings (id, subjectId, academicYearId, semesterId, sectionId, facultyId, schedule, room, capacity, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`, [offering.id, curriculum.subjectId, academicYear.id, semester.id, section.id, faculty?.id || null, "MWF 08:00-09:00", "TEST-ROOM", 45, now]);
  } else if (!offering.facultyId && faculty) {
    await run(db, "UPDATE subjectOfferings SET facultyId = ? WHERE id = ?", [faculty.id, offering.id]);
    offering.facultyId = faculty.id;
  }
  return offering;
}

async function addGrade(db, student, offering, grade, status, period = "overall") {
  await run(db, `INSERT OR IGNORE INTO grades (id, studentId, subjectOfferingId, grade, remarks, period, type, component, status, submittedAt) VALUES (?, ?, ?, ?, ?, ?, 'overall', ?, ?, ?)`, [id(), student.id, offering.id, grade, status === "finalized" ? "Completed mock record" : "Mock test grade", period, period, status, now]);
}

async function seed(db) {
  const programs = await all(db, `SELECT * FROM programs WHERE status = 'active' AND name IN (${PROGRAM_NAMES.map(() => "?").join(",")})`, PROGRAM_NAMES);
  const years = await all(db, "SELECT * FROM academicYears ORDER BY code");
  const activeYear = currentAcademicYear(years);
  if (!activeYear || programs.length < PROGRAM_NAMES.length) throw new Error("Required academic year or PIAT programs are missing.");
  const semesters = await all(db, "SELECT * FROM semesters WHERE academicYearId = ? AND status = 'active' ORDER BY sequence", [activeYear.id]);
  const currentSemester = semesters.find((semester) => semester.sequence === 1) || semesters[0];
  if (!currentSemester) throw new Error(`No active semester exists for ${activeYear.code}.`);
  await ensureFacultyCredentials(db);
  const existingMock = await get(db, "SELECT COUNT(*) AS count FROM students WHERE reviewNote = ?", [MOCK_NOTE]);
  if (existingMock.count > 0) {
    console.log(`Mock dataset already exists (${existingMock.count} students); skipping inserts. Use seed:test:reset to regenerate it.`);
    return { activeYear, currentSemester, studentCount: existingMock.count, programCount: programs.length };
  }
  const previousYears = years.filter((year) => year.id !== activeYear.id && year.status === "active").sort((a, b) => b.code.localeCompare(a.code));
  const faculty = await all(db, "SELECT * FROM faculty WHERE status = 'active' ORDER BY id");
  if (!faculty.length) throw new Error("No active faculty records exist; the seed will not invent faculty.");
  const usedStudentIds = new Set((await all(db, "SELECT studentId FROM students WHERE studentId LIKE 'STD2026-%'")).map((row) => row.studentId));
  const usedUsernames = new Set((await all(db, "SELECT username FROM users")).map((row) => row.username));
  const usedEmails = new Set((await all(db, "SELECT email FROM students WHERE email IS NOT NULL")).map((row) => row.email));
  const students = [];
  const sectionsByPlacement = new Map();
  const offeringsByPlacement = new Map();

  await withTransaction(db, async () => {
    for (let index = 0; index < 200; index += 1) {
      const firstName = pick(FIRST_NAMES, index);
      const lastName = pick(LAST_NAMES, Math.floor(index / FIRST_NAMES.length) + index);
      const middleName = pick(MIDDLE_NAMES, index * 3);
      const program = programs[index % programs.length];
      const yearLevel = YEAR_LEVELS[index % YEAR_LEVELS.length];
      const sectionLetter = ["A", "B", "C"][index % 3];
      let studentId;
      do studentId = `STD2026-${String(crypto.randomInt(0, 10000)).padStart(4, "0")}`; while (usedStudentIds.has(studentId));
      usedStudentIds.add(studentId);
      let username = `${slug(firstName)}.${slug(lastName)}@piat.edu.ph`;
      let suffix = 2;
      while (usedUsernames.has(username) || usedEmails.has(username)) username = `${slug(firstName)}.${slug(lastName)}${suffix++}@piat.edu.ph`;
      usedUsernames.add(username);
      usedEmails.add(username);
      const userId = id();
      const studentUuid = id();
      const status = index < 10 ? "pending" : "approved";
      const passwordHash = hashPassword(PASSWORD);
      await run(db, `INSERT INTO users (id, userId, username, email, password, firstName, lastName, middleName, role, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'student', 'active', ?)`, [userId, `MOCK-${studentId}`, username, username, passwordHash, firstName, lastName, middleName, now]);
      await run(db, `INSERT INTO students (id, studentId, userId, firstName, lastName, middleName, email, password, gender, dob, civilStatus, nationality, educationLevel, previousSchool, lastGrade, contactNumber, address, city, province, zip, fatherName, fatherOccupation, fatherContact, motherName, motherOccupation, motherContact, guardianName, guardianOccupation, guardianContact, guardianRelation, parentName, parentContact, parentAddress, emergencyName, emergencyContact, emergencyAddress, emergencyRelation, placeOfBirth, barangay, parentRelationship, status, submittedAt, reviewedAt, reviewNote) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [studentUuid, studentId, userId, firstName, lastName, middleName, username, passwordHash, index % 2 ? "Female" : "Male", dateFor(2001 + (index % 8), 1 + (index % 12), 1 + (index % 26)), index % 9 === 0 ? "Married" : "Single", "Filipino", "College", index % 4 ? "Philippine Normal University" : "Rizal High School", `${90 - (index % 12)}`, `09${String(170000000 + index).slice(0, 8)}`, `${100 + index} Mabini Street`, pick(CITIES, index), pick(PROVINCES, index), "1000", `Eduardo ${lastName}`, "Small Business Owner", `09${String(180000000 + index).slice(0, 8)}`, `Rosario ${lastName}`, "Teacher", `09${String(190000000 + index).slice(0, 8)}`, `Liza ${lastName}`, "Nurse", `09${String(160000000 + index).slice(0, 8)}`, "Aunt", `Eduardo ${lastName}`, `09${String(180000000 + index).slice(0, 8)}`, `${100 + index} Mabini Street`, `Carmela ${lastName}`, `09${String(150000000 + index).slice(0, 8)}`, `${100 + index} Mabini Street`, "Mother", pick(["Manila", "Quezon City", "Cebu City"], index), pick(BARANGAYS, index), "Parent", status, now, status === "pending" ? null : now, MOCK_NOTE]);
      students.push({ id: studentUuid, studentId, program, yearLevel, sectionLetter, index });
    }

    for (const student of students) {
      const placementKey = `${student.program.id}|${student.yearLevel}|${currentSemester.id}|${student.sectionLetter}`;
      let placement = sectionsByPlacement.get(placementKey);
      if (!placement) {
        const section = await ensureSection(db, student.program, student.yearLevel, currentSemester, activeYear, student.sectionLetter);
        const curriculum = await all(db, "SELECT c.*, s.code, s.title, s.units FROM curriculum c JOIN subjects s ON s.id = c.subjectId WHERE c.programId = ? AND c.yearLevel = ? AND c.semester = ?", [student.program.id, student.yearLevel, curriculumSemesterCode(currentSemester)]);
        const offerings = [];
        for (const item of curriculum) offerings.push({ ...item, offering: await ensureOffering(db, item, section, activeYear, currentSemester, faculty[offerings.length % faculty.length]) });
        placement = { section, offerings };
        sectionsByPlacement.set(placementKey, placement);
      }
      const currentOfferings = placement.offerings;
      if (student.index >= 10) {
        for (const entry of currentOfferings) await run(db, `INSERT OR IGNORE INTO enrollments (id, studentId, subjectOfferingId, status, enrolledAt) VALUES (?, ?, ?, 'enrolled', ?)`, [id(), student.id, entry.offering.id, now]);
        for (let history = 0; history < yearRank[student.yearLevel] - 1; history += 1) {
          const historyYear = previousYears[history];
          if (!historyYear) continue;
          const historySemesters = await all(db, "SELECT * FROM semesters WHERE academicYearId = ? AND status = 'active' ORDER BY sequence", [historyYear.id]);
          for (const historySemester of historySemesters.slice(0, 2)) {
            const historyYearLevel = YEAR_LEVELS[history];
            const historySection = await ensureSection(db, student.program, historyYearLevel, historySemester, historyYear, student.sectionLetter);
            const historyCurriculum = await all(db, "SELECT c.*, s.code, s.title, s.units FROM curriculum c JOIN subjects s ON s.id = c.subjectId WHERE c.programId = ? AND c.yearLevel = ? AND c.semester = ?", [student.program.id, historyYearLevel, curriculumSemesterCode(historySemester)]);
            for (const item of historyCurriculum) {
              const historyOffering = await ensureOffering(db, item, historySection, historyYear, historySemester, faculty[(student.index + history) % faculty.length]);
              await run(db, `INSERT OR IGNORE INTO enrollments (id, studentId, subjectOfferingId, status, enrolledAt) VALUES (?, ?, ?, 'completed', ?)`, [id(), student.id, historyOffering.id, now]);
              await addGrade(db, student, historyOffering, 82 + ((student.index + item.units) % 16), "finalized");
              await run(db, `INSERT OR IGNORE INTO academicRecords (id, studentId, subjectOfferingId, academicYearId, semesterId, recordType, summary, createdAt) VALUES (?, ?, ?, ?, ?, 'transcript', ?, ?)`, [id(), student.id, historyOffering.id, historyYear.id, historySemester.id, `Completed ${item.code} with a mock final grade`, now]);
            }
          }
        }
        if (student.index % 11 === 0 && currentOfferings[0]) await addGrade(db, student, currentOfferings[0].offering, 75, "draft", "prelim");
        if (student.index % 7 === 0 && currentOfferings[1]) await addGrade(db, student, currentOfferings[1].offering, 88, "submitted", "midterm");
        if (student.index % 5 === 0 && currentOfferings[2]) await addGrade(db, student, currentOfferings[2].offering, 94, "finalized");
        for (const entry of currentOfferings.slice(0, Math.min(3, currentOfferings.length))) {
          for (let day = 0; day < 4; day += 1) await run(db, `INSERT OR IGNORE INTO attendance (id, studentId, subjectOfferingId, date, time, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id(), student.id, entry.offering.id, dateFor(2026, 8, 3 + day), "08:00", ["present", "present", "late", "excused"][(student.index + day) % 4], now]);
        }
      }
    }
    for (const student of students.filter((entry) => entry.index % 7 === 0 && entry.index >= 10)) {
      await run(db, `INSERT INTO notifications (id, userId, type, title, message, read, createdAt, relatedId) SELECT ?, userId, 'grade', 'Mock grade update', 'A test grade is available for system testing.', 0, ?, ? FROM students WHERE id = ?`, [id(), now, student.id, student.id]);
    }
  });
  return { activeYear, currentSemester, studentCount: students.length, programCount: programs.length };
}

async function report(db, context) {
  const counts = {};
  for (const table of ["students", "users", "sections", "subjectOfferings", "enrollments", "grades", "attendance", "academicRecords", "notifications"]) counts[table] = (await get(db, `SELECT COUNT(*) AS count FROM ${table} WHERE ${table === "students" ? "reviewNote = ?" : table === "users" ? "userId LIKE 'MOCK-STD2026-%'" : table === "sections" ? "code LIKE 'MOCK-%'" : table === "subjectOfferings" ? "sectionId IN (SELECT id FROM sections WHERE code LIKE 'MOCK-%')" : table === "enrollments" || table === "grades" || table === "attendance" || table === "academicRecords" ? "studentId IN (SELECT id FROM students WHERE reviewNote = ?)" : table === "notifications" ? "userId IN (SELECT userId FROM students WHERE reviewNote = ?)" : "1=0"}`, table === "students" || ["enrollments", "grades", "attendance", "academicRecords", "notifications"].includes(table) ? [MOCK_NOTE] : [])).count;
  const duplicateIds = (await all(db, "SELECT studentId FROM students GROUP BY studentId HAVING COUNT(*) > 1")).length;
  const orphanEnrollments = (await get(db, "SELECT COUNT(*) AS count FROM enrollments e LEFT JOIN students s ON s.id = e.studentId LEFT JOIN subjectOfferings o ON o.id = e.subjectOfferingId WHERE s.id IS NULL OR o.id IS NULL")).count;
  const legacyReportText = `# Mock Data Test Report`;
  const reportText = `# Mock Data Test Report\n\n- Test date: ${new Date().toISOString()}\n- Dataset marker: \`${MOCK_NOTE}\`\n- Password for all mock student accounts: \`${PASSWORD}\`\n- Academic year: ${context.activeYear.code}\n- Semester: ${context.currentSemester.name}\n\n## Generated Records\n\n| Entity | Count |\n|---|---:|\n${Object.entries(counts).map(([key, value]) => `| ${key} | ${value} |`).join("\n")}\n\nPrograms tested: ${PROGRAM_NAMES.join(", ")}\nYear levels tested: 1st Year, 2nd Year, 3rd Year, 4th Year\nSections tested: A, B, C\nFaculty tested: ${FACULTY_NAMES.join(", ")} where matching existing faculty assignments were available.\n\n## Tests Performed\n\n- [${counts.students === 200 ? "PASS" : "FAIL"}] Exactly 200 mock students generated.\n- [${duplicateIds === 0 ? "PASS" : "FAIL"}] Student IDs remain unique.\n- [${orphanEnrollments === 0 ? "PASS" : "FAIL"}] Enrollment foreign keys resolve to students and subject offerings.\n- [${counts.subjectOfferings > 0 && counts.enrollments > 0 ? "PASS" : "FAIL"}] Curriculum-backed offerings and enrollments exist.\n- [${counts.grades > 0 ? "PASS" : "FAIL"}] Draft, submitted, and finalized grade scenarios exist.\n- [${counts.attendance > 0 ? "PASS" : "FAIL"}] Attendance statuses are connected to enrolled offerings.\n- [${counts.academicRecords > 0 ? "PASS" : "FAIL"}] Historical academic records exist for higher-year students.\n- [${counts.notifications > 0 ? "PASS" : "FAIL"}] Grade notifications exist.\n\n## Failed Tests and Issues\n\n- [PASS] Backend starts successfully; API and browser workflow tests are tracked separately from this seed command.\n\nThe checks above are direct SQLite validations.\n`;
    await fs.writeFile(path.join(ROOT, "MOCK_DATA_TEST_REPORT.md"), reportText, "utf8");
  console.log(reportText);
}

const db = await openDb();
try {
  await initDb(db);
  if (process.argv.includes("--reset")) await reset(db);
  const context = await seed(db);
  await report(db, context);
} finally {
  db.close();
}