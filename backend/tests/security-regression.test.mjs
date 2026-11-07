import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";
import { after, before, test } from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "..");
const jwtSecret = "piat_security_regression_secret_for_isolated_tests";
const testPassword = "Security-Test-Password-123!";
let tempDir;
let databasePath;
let baseUrl;
let serverProcess;
let adminToken;
let admin;
const openDatabases = new Set();

function openTestDatabase() {
  const db = new sqlite3.Database(databasePath);
  openDatabases.add(db);
  return db;
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
  });
}

async function queryOne(sql, params = []) {
  const db = openTestDatabase();
  try {
    return await dbGet(db, sql, params);
  } finally {
    await closeDatabase(db);
  }
}

function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      openDatabases.delete(db);
      if (error) reject(error);
      else resolve();
    });
  });
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function request(method, route, body, token, headers = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function waitForBackend() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Isolated backend exited before readiness (code ${serverProcess.exitCode})`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/users`);
      if (response.status === 401) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Isolated backend did not become ready");
}

async function createAccount(role, name) {
  const body = {
    role,
    firstName: name,
    lastName: "Regression",
    password: testPassword,
    ...(role === "student"
      ? { email: `${name.toLowerCase()}.${crypto.randomUUID()}@example.test` }
      : {}),
  };
  const created = await request("POST", "/api/users", body, adminToken);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  return { ...created.data, loginEmail: role === "student" ? body.email : created.data.email };
}

async function login(email, route = "/api/users/login", password = testPassword) {
  return request("POST", route, { email, password });
}

async function recordCounts() {
  const db = openTestDatabase();
  const counts = {};
  for (const table of ["enrollments", "sections", "subjectOfferings", "notifications"]) {
    const row = await dbGet(db, `SELECT COUNT(*) AS count FROM ${table}`);
    counts[table] = row.count;
  }
  await closeDatabase(db);
  return counts;
}

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "piat-security-regression-"));
  databasePath = path.join(tempDir, "security-test.db");
  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["index.js"], {
    cwd: backendDir,
    env: {
      ...process.env,
      JWT_SECRET: jwtSecret,
      PIAT_DB_PATH: databasePath,
      PIAT_ALLOW_DEMO_ACCOUNTS: "true",
      PORT: String(port),
    },
    stdio: "ignore",
  });
  await waitForBackend();
  const adminLogin = await login("admin@piat.edu.ph", "/api/users/login", "admin123");
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.data));
  adminToken = adminLogin.data.token;
  admin = adminLogin.data;
});

after(async () => {
  for (const db of openDatabases) await closeDatabase(db);
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await Promise.race([
      new Promise((resolve) => serverProcess.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("sensitive role and resource boundaries reject unauthorized access without mutation", async () => {
  const registrar = await createAccount("registrar", "Registrar");
  const facultyA = await createAccount("faculty", "FacultyA");
  const facultyB = await createAccount("faculty", "FacultyB");
  const studentA = await createAccount("student", "StudentA");
  const studentB = await createAccount("student", "StudentB");
  const inactiveStudent = await createAccount("student", "InactiveStudent");
  const inactiveFaculty = await createAccount("faculty", "InactiveFaculty");

  const [
    registrarLogin,
    facultyALogin,
    facultyBLogin,
    studentALogin,
    inactiveStudentLogin,
    inactiveFacultyLogin,
  ] = await Promise.all([
    login(registrar.email),
    login(facultyA.email),
    login(facultyB.email),
    login(studentA.loginEmail, "/api/students/login"),
    login(inactiveStudent.loginEmail, "/api/students/login"),
    login(inactiveFaculty.email),
  ]);
  for (const result of [
    registrarLogin,
    facultyALogin,
    facultyBLogin,
    studentALogin,
    inactiveStudentLogin,
    inactiveFacultyLogin,
  ]) {
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }

  const deniedAdminCreation = await request(
    "POST",
    "/api/users",
    { role: "admin", firstName: "Escalated", lastName: "Regression" },
    registrarLogin.data.token,
  );
  assert.equal(deniedAdminCreation.status, 403);
  const db = openTestDatabase();
  assert.equal(
    (await dbGet(db, "SELECT COUNT(*) AS count FROM users WHERE firstName = 'Escalated'")).count,
    0,
  );

  const academicYear = await dbGet(db, "SELECT id FROM academicYears LIMIT 1");
  const semester = await dbGet(db, "SELECT id FROM semesters WHERE academicYearId = ? LIMIT 1", [
    academicYear.id,
  ]);
  const program = await dbGet(db, "SELECT id FROM programs LIMIT 1");
  const subject = await dbGet(db, "SELECT id FROM subjects LIMIT 1");
  assert.ok(
    academicYear && semester && program && subject,
    "fresh test database should seed academic catalogs",
  );
  const offerings = [];
  for (const suffix of ["A", "B"]) {
    const sectionId = crypto.randomUUID();
    const offeringId = crypto.randomUUID();
    await dbRun(
      db,
      `INSERT INTO sections (id, code, name, programId, yearLevel, semesterId, academicYearId, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        sectionId,
        `SEC-SECURITY-${suffix}`,
        `Security Test ${suffix}`,
        program.id,
        "1st Year",
        semester.id,
        academicYear.id,
        Date.now(),
      ],
    );
    await dbRun(
      db,
      `INSERT INTO subjectOfferings (id, subjectId, academicYearId, semesterId, sectionId, status, createdAt)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [offeringId, subject.id, academicYear.id, semester.id, sectionId, Date.now()],
    );
    offerings.push({ id: offeringId });
  }

  const facultyARow = await dbGet(db, "SELECT id FROM faculty WHERE userId = ?", [facultyA.id]);
  const facultyBRow = await dbGet(db, "SELECT id FROM faculty WHERE userId = ?", [facultyB.id]);
  const studentARow = await dbGet(db, "SELECT id FROM students WHERE studentId = ?", [
    studentA.studentId,
  ]);
  const studentBRow = await dbGet(db, "SELECT id FROM students WHERE studentId = ?", [
    studentB.studentId,
  ]);
  await dbRun(db, "UPDATE subjectOfferings SET facultyId = ? WHERE id = ?", [
    facultyARow.id,
    offerings[0].id,
  ]);
  await dbRun(db, "UPDATE subjectOfferings SET facultyId = ? WHERE id = ?", [
    facultyBRow.id,
    offerings[1].id,
  ]);
  await closeDatabase(db);

  for (const [student, offering] of [
    [studentA, offerings[0]],
    [studentB, offerings[1]],
  ]) {
    const enrollment = await request(
      "POST",
      "/api/enrollments",
      { studentId: student.studentId, offeringIds: [offering.id] },
      adminToken,
    );
    assert.equal(enrollment.status, 201, JSON.stringify(enrollment.data));
  }

  const noAuthReenrollmentCounts = await recordCounts();
  const unauthorizedReenrollment = await request(
    "POST",
    `/api/students/${studentA.studentId}/reenroll`,
    {},
  );
  assert.equal(unauthorizedReenrollment.status, 401);
  const facultyReenrollment = await request(
    "POST",
    `/api/students/${studentA.studentId}/reenroll`,
    {},
    facultyALogin.data.token,
  );
  assert.equal(facultyReenrollment.status, 403);
  assert.deepEqual(await recordCounts(), noAuthReenrollmentCounts);

  const gradeA = await request(
    "POST",
    "/api/grades",
    { studentId: studentA.studentId, subjectOfferingId: offerings[0].id, grade: 88 },
    facultyALogin.data.token,
  );
  assert.equal(gradeA.status, 201, JSON.stringify(gradeA.data));
  const gradeB = await request(
    "POST",
    "/api/grades",
    { studentId: studentB.studentId, subjectOfferingId: offerings[1].id, grade: 91 },
    facultyBLogin.data.token,
  );
  assert.equal(gradeB.status, 201, JSON.stringify(gradeB.data));

  const facultyGrades = await request("GET", "/api/grades", undefined, facultyALogin.data.token);
  assert.equal(facultyGrades.status, 200);
  assert.ok(facultyGrades.data.data.every((grade) => grade.subjectOfferingId === offerings[0].id));
  const facultyOtherStudentGrades = await request(
    "GET",
    `/api/grades?studentId=${studentB.studentId}`,
    undefined,
    facultyALogin.data.token,
  );
  assert.equal(facultyOtherStudentGrades.status, 200);
  assert.deepEqual(facultyOtherStudentGrades.data.data, []);

  const gradeCountBeforeDelete = await queryOne(
    "SELECT COUNT(*) AS count FROM grades WHERE studentId = ? AND subjectOfferingId = ?",
    [studentBRow.id, offerings[1].id],
  );
  const crossOfferingDelete = await request(
    "DELETE",
    `/api/grades?studentId=${studentB.studentId}&subjectOfferingId=${offerings[1].id}`,
    undefined,
    facultyALogin.data.token,
  );
  assert.equal(crossOfferingDelete.status, 403);
  const verifyDeleteDb = openTestDatabase();
  assert.deepEqual(
    await dbGet(
      verifyDeleteDb,
      "SELECT COUNT(*) AS count FROM grades WHERE studentId = ? AND subjectOfferingId = ?",
      [studentBRow.id, offerings[1].id],
    ),
    gradeCountBeforeDelete,
  );
  await closeDatabase(verifyDeleteDb);

  const unassignedGradeCount = await queryOne(
    "SELECT COUNT(*) AS count FROM grades WHERE studentId = ? AND subjectOfferingId = ?",
    [studentBRow.id, offerings[0].id],
  );
  const unassignedGrade = await request(
    "POST",
    "/api/grades",
    { studentId: studentB.studentId, subjectOfferingId: offerings[0].id, grade: 75 },
    facultyALogin.data.token,
  );
  assert.equal(unassignedGrade.status, 403);
  const verifyEnrollmentDb = openTestDatabase();
  assert.deepEqual(
    await dbGet(
      verifyEnrollmentDb,
      "SELECT COUNT(*) AS count FROM grades WHERE studentId = ? AND subjectOfferingId = ?",
      [studentBRow.id, offerings[0].id],
    ),
    unassignedGradeCount,
  );
  await closeDatabase(verifyEnrollmentDb);

  const finalizedGrade = await request(
    "POST",
    "/api/grades",
    {
      studentId: studentA.studentId,
      subjectOfferingId: offerings[0].id,
      grade: 88,
      status: "finalized",
    },
    facultyALogin.data.token,
  );
  assert.equal(finalizedGrade.status, 403);
  const finalizedCount = await queryOne(
    "SELECT COUNT(*) AS count FROM grades WHERE studentId = ? AND subjectOfferingId = ? AND status = 'finalized'",
    [studentARow.id, offerings[0].id],
  );
  assert.equal(finalizedCount.count, 0);

  const seedFinalizedDb = openTestDatabase();
  await dbRun(
    seedFinalizedDb,
    `INSERT INTO grades (id, studentId, subjectOfferingId, grade, period, type, status, submittedAt)
     VALUES (?, ?, ?, ?, 'prelim', 'overall', 'finalized', ?)`,
    [crypto.randomUUID(), studentARow.id, offerings[0].id, 88, Date.now()],
  );
  const finalizedRowBefore = await dbGet(
    seedFinalizedDb,
    "SELECT id, grade, status FROM grades WHERE studentId = ? AND subjectOfferingId = ? AND period = 'prelim' AND status = 'finalized'",
    [studentARow.id, offerings[0].id],
  );
  await closeDatabase(seedFinalizedDb);
  const finalizedGradeEdit = await request(
    "POST",
    "/api/grades",
    {
      studentId: studentA.studentId,
      subjectOfferingId: offerings[0].id,
      grade: 99,
      period: "prelim",
    },
    facultyALogin.data.token,
  );
  assert.equal(finalizedGradeEdit.status, 409);
  const verifyFinalizedDb = openTestDatabase();
  assert.deepEqual(
    await dbGet(verifyFinalizedDb, "SELECT id, grade, status FROM grades WHERE id = ?", [
      finalizedRowBefore.id,
    ]),
    finalizedRowBefore,
  );
  await closeDatabase(verifyFinalizedDb);

  const attendanceDb = openTestDatabase();
  await dbRun(
    attendanceDb,
    `INSERT INTO attendance (id, studentId, subjectOfferingId, date, time, status, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      studentBRow.id,
      offerings[1].id,
      "2026-10-01",
      null,
      "present",
      Date.now(),
    ],
  );
  await closeDatabase(attendanceDb);
  const crossOfferingAttendance = await request(
    "GET",
    `/api/attendance?studentId=${studentB.studentId}`,
    undefined,
    facultyALogin.data.token,
  );
  assert.equal(crossOfferingAttendance.status, 200);
  assert.deepEqual(crossOfferingAttendance.data, []);
  const explicitOtherOfferingAttendance = await request(
    "GET",
    `/api/attendance?subjectOfferingId=${offerings[1].id}`,
    undefined,
    facultyALogin.data.token,
  );
  assert.equal(explicitOtherOfferingAttendance.status, 403);

  const roster = await request(
    "GET",
    `/api/faculty/subjects/${offerings[0].id}/students`,
    undefined,
    facultyALogin.data.token,
  );
  assert.equal(roster.status, 200);
  assert.deepEqual(Object.keys(roster.data[0]).sort(), [
    "firstName",
    "id",
    "lastName",
    "studentId",
  ]);

  const personalUpdate = await request(
    "PUT",
    `/api/students/${studentA.studentId}`,
    { contactNumber: "+639171234567" },
    studentALogin.data.token,
  );
  assert.equal(personalUpdate.status, 200, JSON.stringify(personalUpdate.data));
  assert.equal(personalUpdate.data.contactNumber, "+639171234567");
  const protectedStudentState = await queryOne(
    "SELECT status, reviewedAt, reviewNote, studentId FROM students WHERE id = ?",
    [studentARow.id],
  );
  for (const payload of [
    { status: "approved" },
    { status: "rejected" },
    { program: "Unauthorized Program" },
    { yearLevel: "4th Year" },
    { studentId: studentB.studentId },
    { reviewedAt: Date.now(), reviewNote: "Forged review" },
  ]) {
    const deniedUpdate = await request(
      "PUT",
      `/api/students/${studentA.studentId}`,
      payload,
      studentALogin.data.token,
    );
    assert.equal(deniedUpdate.status, 403, JSON.stringify(deniedUpdate.data));
    assert.deepEqual(
      await queryOne(
        "SELECT status, reviewedAt, reviewNote, studentId FROM students WHERE id = ?",
        [studentARow.id],
      ),
      protectedStudentState,
    );
  }
  const crossStudentUpdate = await request(
    "PUT",
    `/api/students/${studentB.studentId}`,
    { contactNumber: "+639171234567" },
    studentALogin.data.token,
  );
  assert.equal(crossStudentUpdate.status, 403);
  assert.notEqual(
    (await queryOne("SELECT contactNumber FROM students WHERE id = ?", [studentBRow.id]))
      .contactNumber,
    "+639171234567",
  );

  const adminManagedStudent = await request(
    "PUT",
    `/api/students/${studentB.studentId}`,
    { status: "rejected", reviewedAt: Date.now(), reviewNote: "Synthetic admin review" },
    adminToken,
  );
  assert.equal(adminManagedStudent.status, 200, JSON.stringify(adminManagedStudent.data));
  const registrarManagedStudent = await request(
    "PUT",
    `/api/students/${studentB.studentId}`,
    { status: "approved", reviewedAt: Date.now(), reviewNote: "Synthetic registrar approval" },
    registrarLogin.data.token,
  );
  assert.equal(registrarManagedStudent.status, 200, JSON.stringify(registrarManagedStudent.data));
  assert.equal(registrarManagedStudent.data.status, "approved");
  const managedAdminAccount = await request(
    "POST",
    "/api/users",
    {
      role: "admin",
      firstName: "ManagedAdmin",
      lastName: "Regression",
      email: `managed-admin-${crypto.randomUUID()}@example.test`,
      password: testPassword,
    },
    adminToken,
  );
  assert.equal(managedAdminAccount.status, 201, JSON.stringify(managedAdminAccount.data));
  assert.equal(managedAdminAccount.data.role, "admin");

  const applicationProgram = await queryOne(
    "SELECT id, name FROM programs WHERE status = 'active' LIMIT 1",
  );
  const applicationAcademicYear = await queryOne(
    "SELECT id, code FROM academicYears WHERE status = 'active' LIMIT 1",
  );
  const applicationSemester = await queryOne(
    "SELECT id, name FROM semesters WHERE academicYearId = ? LIMIT 1",
    [applicationAcademicYear.id],
  );
  const applicationCurriculum = await queryOne(
    "SELECT yearLevel FROM curriculum WHERE programId = ? LIMIT 1",
    [applicationProgram.id],
  );
  const registrationPayload = {
    firstName: "StudentA",
    lastName: "Regression",
    gender: "Male",
    dob: "2000-01-01",
    civilStatus: "Single",
    nationality: "Filipino",
    email: studentA.loginEmail,
    contactNumber: "+639171234567",
    address: "100 Test Street",
    region: "NCR",
    province: "Metro Manila",
    city: "Manila",
    barangay: "Test",
    zip: "1000",
    parentName: "Synthetic Parent",
    parentRelationship: "Parent",
    parentContact: "+639171234568",
    program: applicationProgram.name,
    yearLevel: applicationCurriculum.yearLevel,
    semester: applicationSemester.name,
    academicYear: applicationAcademicYear.code,
  };
  const pendingStudentDb = openTestDatabase();
  await dbRun(
    pendingStudentDb,
    "UPDATE students SET status = 'pending', reviewedAt = NULL, reviewNote = NULL WHERE id = ?",
    [studentARow.id],
  );
  await closeDatabase(pendingStudentDb);
  const enrollmentCountBeforeRegistration = await queryOne(
    "SELECT COUNT(*) AS count FROM enrollments WHERE studentId = ?",
    [studentARow.id],
  );
  const registrationStateBefore = await queryOne(
    "SELECT status, reviewedAt, reviewNote, studentId FROM students WHERE id = ?",
    [studentARow.id],
  );
  const applicationStateBefore = await queryOne(
    "SELECT * FROM studentRegistrationApplications WHERE studentId = ?",
    [studentARow.id],
  );
  for (const protectedPayload of [
    { ...registrationPayload, status: "approved" },
    { ...registrationPayload, studentId: studentB.studentId },
  ]) {
    const rejectedRegistration = await request(
      "POST",
      "/api/students/me/registration",
      protectedPayload,
      studentALogin.data.token,
    );
    assert.equal(rejectedRegistration.status, 403);
    assert.deepEqual(
      await queryOne(
        "SELECT status, reviewedAt, reviewNote, studentId FROM students WHERE id = ?",
        [studentARow.id],
      ),
      registrationStateBefore,
    );
    assert.deepEqual(
      await queryOne("SELECT * FROM studentRegistrationApplications WHERE studentId = ?", [
        studentARow.id,
      ]),
      applicationStateBefore,
    );
  }
  const submittedRegistration = await request(
    "POST",
    "/api/students/me/registration",
    registrationPayload,
    studentALogin.data.token,
  );
  assert.equal(submittedRegistration.status, 200, JSON.stringify(submittedRegistration.data));
  assert.equal(submittedRegistration.data.status, "pending");
  assert.deepEqual(
    await queryOne(
      "SELECT programId, yearLevel, semesterId, academicYearId FROM studentRegistrationApplications WHERE studentId = ?",
      [studentARow.id],
    ),
    {
      programId: applicationProgram.id,
      yearLevel: applicationCurriculum.yearLevel,
      semesterId: applicationSemester.id,
      academicYearId: applicationAcademicYear.id,
    },
  );
  assert.deepEqual(
    await queryOne("SELECT COUNT(*) AS count FROM enrollments WHERE studentId = ?", [
      studentARow.id,
    ]),
    enrollmentCountBeforeRegistration,
  );
  const pendingRegistrations = await request(
    "GET",
    "/api/students?status=pending",
    undefined,
    registrarLogin.data.token,
  );
  assert.equal(pendingRegistrations.status, 200);
  const pendingApplication = pendingRegistrations.data.data.find(
    (student) => student.studentId === studentA.studentId,
  );
  assert.ok(pendingApplication);
  assert.equal(pendingApplication.program, applicationProgram.name);
  assert.equal(pendingApplication.yearLevel, applicationCurriculum.yearLevel);
  const registrationDetail = await request(
    "GET",
    `/api/students/${studentA.studentId}`,
    undefined,
    registrarLogin.data.token,
  );
  assert.equal(registrationDetail.status, 200);
  assert.equal(registrationDetail.data.semester, applicationSemester.name);
  assert.equal(registrationDetail.data.academicYear, applicationAcademicYear.code);

  const announcementRecords = [];
  for (const audience of ["all", "student", "faculty"]) {
    const created = await request(
      "POST",
      "/api/announcements",
      {
        title: `Security ${audience} announcement`,
        body: `Synthetic ${audience} content`,
        category: "general",
        audience,
        authorName: "Regression Test",
        authorRole: "admin",
      },
      adminToken,
    );
    assert.equal(created.status, 201, JSON.stringify(created.data));
    announcementRecords.push(created.data);
  }
  const announcementCountBeforeInvalidAudience = await queryOne(
    "SELECT COUNT(*) AS count FROM announcements",
  );
  const unsupportedAdminAudience = await request(
    "POST",
    "/api/announcements",
    {
      title: "Unsupported administrator audience",
      body: "This audience does not exist in the schema.",
      category: "general",
      audience: "admin",
    },
    adminToken,
  );
  assert.equal(unsupportedAdminAudience.status, 400);
  assert.deepEqual(
    await queryOne("SELECT COUNT(*) AS count FROM announcements"),
    announcementCountBeforeInvalidAudience,
  );

  const publicAnnouncements = await request(
    "GET",
    "/api/announcements?audience=faculty&role=faculty",
  );
  assert.deepEqual(
    publicAnnouncements.data.map((item) => item.id).sort(),
    [announcementRecords[0].id].sort(),
  );
  const studentAnnouncements = await request(
    "GET",
    "/api/announcements?audience=faculty&role=faculty",
    undefined,
    studentALogin.data.token,
  );
  assert.deepEqual(
    studentAnnouncements.data.map((item) => item.id).sort(),
    announcementRecords
      .filter((item) => item.audience === "all" || item.audience === "student")
      .map((item) => item.id)
      .sort(),
  );
  const facultyAnnouncements = await request(
    "GET",
    "/api/announcements?audience=student&role=admin",
    undefined,
    facultyALogin.data.token,
  );
  assert.deepEqual(
    facultyAnnouncements.data.map((item) => item.id).sort(),
    announcementRecords
      .filter((item) => item.audience === "all" || item.audience === "faculty")
      .map((item) => item.id)
      .sort(),
  );
  for (const token of [registrarLogin.data.token, adminToken]) {
    const managementAnnouncements = await request(
      "GET",
      "/api/announcements?audience=all",
      undefined,
      token,
    );
    assert.deepEqual(
      managementAnnouncements.data.map((item) => item.id).sort(),
      announcementRecords.map((item) => item.id).sort(),
    );
  }

  const staffLoginEmail = `rate-limit-staff-${crypto.randomUUID()}@example.test`;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const failedLogin = await request(
      "POST",
      "/api/users/login",
      { email: staffLoginEmail, password: "incorrect" },
      undefined,
      { "X-Forwarded-For": `198.51.100.${attempt + 1}` },
    );
    assert.equal(failedLogin.status, 401);
  }
  assert.equal(
    (
      await request(
        "POST",
        "/api/users/login",
        { email: staffLoginEmail, password: "incorrect" },
        undefined,
        { "X-Forwarded-For": "203.0.113.99" },
      )
    ).status,
    429,
  );

  const studentLoginEmail = `rate-limit-student-${crypto.randomUUID()}@example.test`;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const failedLogin = await request(
      "POST",
      "/api/students/login",
      { email: studentLoginEmail, password: "incorrect" },
      undefined,
      { "X-Forwarded-For": `192.0.2.${attempt + 1}` },
    );
    assert.equal(failedLogin.status, 401);
  }
  assert.equal(
    (
      await request(
        "POST",
        "/api/students/login",
        { email: studentLoginEmail, password: "incorrect" },
        undefined,
        { "X-Forwarded-For": "203.0.113.100" },
      )
    ).status,
    429,
  );
  assert.equal((await login(facultyA.email)).status, 200);
  assert.equal((await login(studentA.loginEmail, "/api/students/login")).status, 200);

  const inactiveUserToken = inactiveFacultyLogin.data.token;
  const deactivateFaculty = await request(
    "PATCH",
    `/api/users/${inactiveFaculty.id}/status`,
    { status: "inactive" },
    adminToken,
  );
  assert.equal(deactivateFaculty.status, 200);
  assert.equal((await request("GET", "/api/users", undefined, inactiveUserToken)).status, 401);
  assert.equal((await login(inactiveFaculty.email)).status, 401);

  const deactivateStudent = await request(
    "PATCH",
    `/api/users/${inactiveStudent.id}/status`,
    { status: "inactive" },
    adminToken,
  );
  assert.equal(deactivateStudent.status, 200);
  assert.equal(
    (await request("GET", "/api/enrollments", undefined, inactiveStudentLogin.data.token)).status,
    401,
  );
  assert.equal(
    (
      await request(
        "GET",
        `/api/students/${inactiveStudent.studentId}`,
        undefined,
        inactiveStudentLogin.data.token,
      )
    ).status,
    401,
  );
  assert.equal((await login(inactiveStudent.loginEmail, "/api/students/login")).status, 401);
  assert.equal(admin.role, "admin");

  const integrityDb = openTestDatabase();
  assert.equal((await dbGet(integrityDb, "PRAGMA integrity_check")).integrity_check, "ok");
  assert.deepEqual(await dbAll(integrityDb, "PRAGMA foreign_key_check"), []);
  await closeDatabase(integrityDb);
});
