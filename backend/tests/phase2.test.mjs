import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";
import { after, before, test } from "node:test";
import { validateRegistrationPayload } from "../registration/workflow.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "..");
const sourceDatabase = path.join(backendDir, "piat.db");
const jwtSecret = "phase2_test_jwt_secret_value_only_for_isolated_tests";
const testPassword = "Phase2-Test-Password-123!";
let tempDir;
let databasePath;
let baseUrl;
let serverProcess;
let adminEmail;
let adminToken;
let testStudent;
let testStudentToken;
let otherStudent;
let testFaculty;
let otherFaculty;
let selectedOffering;

function openTestDatabase() {
  return new sqlite3.Database(databasePath);
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

function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((error) => (error ? reject(error) : resolve()));
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

async function request(method, route, body, token) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/users`);
      if (response.status === 401) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Isolated backend did not become ready");
}

async function createAccount(role, firstName, lastName) {
  const body = {
    role,
    firstName,
    lastName,
    password: testPassword,
    ...(role === "student"
      ? { email: `${firstName.toLowerCase()}.${crypto.randomUUID()}@example.test` }
      : {}),
  };
  const created = await request("POST", "/api/users", body, adminToken);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  return created.data;
}

async function login(email, password = testPassword) {
  return request("POST", "/api/users/login", { email, password });
}

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "piat-phase2-"));
  databasePath = path.join(tempDir, "piat-test.db");
  await copyFile(sourceDatabase, databasePath);

  const db = openTestDatabase();
  const admin = await dbGet(db, "SELECT id, email FROM users WHERE role = 'admin' LIMIT 1");
  assert.ok(admin, "the isolated database copy must contain an administrator account");
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = `scrypt$${salt}$${crypto.scryptSync(testPassword, salt, 64).toString("hex")}`;
  await dbRun(db, "UPDATE users SET password = ?, status = 'active' WHERE id = ?", [
    passwordHash,
    admin.id,
  ]);
  adminEmail = admin.email;

  selectedOffering = await dbGet(
    db,
    `SELECT o.id FROM subjectOfferings o
     JOIN enrollments e ON e.subjectOfferingId = o.id AND e.status = 'enrolled'
     LIMIT 1`,
  );
  assert.ok(selectedOffering, "the isolated database copy must contain an enrolled offering");
  await closeDatabase(db);

  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["index.js"], {
    cwd: backendDir,
    env: {
      ...process.env,
      JWT_SECRET: jwtSecret,
      PIAT_DB_PATH: databasePath,
      PORT: String(port),
    },
    stdio: "ignore",
  });
  await waitForBackend();

  const adminLogin = await login(adminEmail);
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.data));
  adminToken = adminLogin.data.token;
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await Promise.race([
      new Promise((resolve) => serverProcess.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("registration validation distinguishes incomplete and complete submissions", () => {
  const incomplete = validateRegistrationPayload({ firstName: "Incomplete" });
  assert.equal(incomplete.isValid, false);
  assert.ok(incomplete.missing.includes("region"));

  const complete = Object.fromEntries(
    [
      "firstName",
      "lastName",
      "gender",
      "dob",
      "civilStatus",
      "nationality",
      "email",
      "contactNumber",
      "address",
      "region",
      "province",
      "city",
      "barangay",
      "zip",
      "parentName",
      "parentRelationship",
      "parentContact",
      "program",
      "yearLevel",
      "semester",
      "academicYear",
    ].map((field) => [field, "valid"]),
  );
  assert.equal(validateRegistrationPayload(complete).isValid, true);
});

test("isolated backend enforces auth, ownership, idempotency, and record finalization", async () => {
  const missingJwt = await request("GET", "/api/users");
  assert.equal(missingJwt.status, 401);

  const invalidJwt = await request("GET", "/api/users", undefined, "invalid.token.value");
  assert.equal(invalidJwt.status, 401);
  const expiredJwt = await request(
    "GET",
    "/api/users",
    undefined,
    (await import("jsonwebtoken")).default.sign({ id: "expired", role: "admin" }, jwtSecret, {
      expiresIn: "0s",
    }),
  );
  assert.equal(expiredJwt.status, 401);

  const forgedHeaders = await fetch(`${baseUrl}/api/users`, {
    headers: { "x-user-id": "admin", "x-user-role": "admin" },
  });
  assert.equal(forgedHeaders.status, 401);
  assert.equal((await request("GET", "/api/users", undefined, adminToken)).status, 200);

  const badKnownUser = await login(adminEmail, "incorrect-password");
  const badUnknownUser = await login("missing.phase2.user@example.test", "incorrect-password");
  assert.equal(badKnownUser.status, 401);
  assert.equal(badUnknownUser.status, 401);
  assert.deepEqual(badKnownUser.data, badUnknownUser.data);

  testStudent = await createAccount("student", "Phase2", "Student");
  otherStudent = await createAccount("student", "Phase2Other", "Student");
  testFaculty = await createAccount("faculty", "Phase2", "Faculty");
  otherFaculty = await createAccount("faculty", "Phase2Other", "Faculty");

  const studentLogin = await login(testStudent.email);
  assert.equal(studentLogin.status, 200);
  testStudentToken = studentLogin.data.token;
  const otherFacultyLogin = await login(otherFaculty.email);
  assert.equal(otherFacultyLogin.status, 200);
  const otherFacultyToken = otherFacultyLogin.data.token;

  const forbiddenUsers = await request("GET", "/api/users", undefined, testStudentToken);
  assert.equal(forbiddenUsers.status, 403);
  const subject = await request("GET", "/api/subjects");
  assert.ok(subject.status === 200);
  const subjectRows = Array.isArray(subject.data) ? subject.data : subject.data.data;
  const destructiveDenied = await request(
    "DELETE",
    `/api/subjects/${subjectRows[0].id}`,
    undefined,
    testStudentToken,
  );
  assert.equal(destructiveDenied.status, 403);

  const ownNotification = await request(
    "POST",
    "/api/notifications",
    { userId: testStudent.id, type: "general", title: "Own", message: "Own notification" },
    testStudentToken,
  );
  assert.equal(ownNotification.status, 201);
  const adminNotification = await request(
    "POST",
    "/api/notifications",
    {
      userId: (await request("GET", "/api/users", undefined, adminToken)).data.data[0].id,
      type: "general",
      title: "Admin",
      message: "Private",
    },
    adminToken,
  );
  assert.equal(adminNotification.status, 201);
  const ownNotifications = await request(
    "GET",
    `/api/notifications?userId=${testStudent.id}`,
    undefined,
    testStudentToken,
  );
  assert.equal(ownNotifications.status, 200);
  assert.equal(ownNotifications.data.length, 1);
  const crossNotifications = await request(
    "GET",
    `/api/notifications?userId=${adminNotification.data.userId}`,
    undefined,
    testStudentToken,
  );
  assert.equal(crossNotifications.status, 403);
  const modifyCrossNotification = await request(
    "PATCH",
    `/api/notifications/${adminNotification.data.id}/read`,
    {},
    testStudentToken,
  );
  assert.equal(modifyCrossNotification.status, 403);
  const deleteCrossNotifications = await request(
    "DELETE",
    `/api/notifications?userId=${adminNotification.data.userId}`,
    undefined,
    testStudentToken,
  );
  assert.equal(deleteCrossNotifications.status, 403);

  const db = openTestDatabase();
  const facultyRow = await dbGet(db, "SELECT id FROM faculty WHERE userId = ?", [testFaculty.id]);
  const otherOffering = await dbGet(db, "SELECT id FROM subjectOfferings WHERE id != ? LIMIT 1", [
    selectedOffering.id,
  ]);
  assert.ok(facultyRow && otherOffering);
  await dbRun(db, "UPDATE subjectOfferings SET facultyId = ? WHERE id = ?", [
    facultyRow.id,
    selectedOffering.id,
  ]);
  await closeDatabase(db);

  const enrollment = await request(
    "POST",
    "/api/enrollments",
    { studentId: testStudent.studentId, offeringIds: [selectedOffering.id] },
    adminToken,
  );
  assert.equal(enrollment.status, 201);
  assert.equal(enrollment.data.length, 1);
  const duplicateEnrollment = await request(
    "POST",
    "/api/enrollments",
    { studentId: testStudent.studentId, offeringIds: [selectedOffering.id] },
    adminToken,
  );
  assert.equal(duplicateEnrollment.status, 201);
  assert.equal(duplicateEnrollment.data.length, 0);

  const approvalDb = openTestDatabase();
  await dbRun(approvalDb, "UPDATE students SET status = 'approved' WHERE studentId = ?", [
    testStudent.studentId,
  ]);
  await closeDatabase(approvalDb);
  const eligibleStudents = await request(
    "GET",
    "/api/students/eligible-for-reenrollment",
    undefined,
    adminToken,
  );
  assert.equal(eligibleStudents.status, 200);
  const eligibleStudent = eligibleStudents.data.find(
    (student) => student.studentId === testStudent.studentId,
  );
  assert.ok(eligibleStudent, "approved enrolled students should appear in re-enrollment");
  for (const field of ["firstName", "lastName", "program", "yearLevel", "semester", "academicYear"]) {
    assert.equal(typeof eligibleStudent[field], "string", `${field} should be populated`);
    assert.ok(eligibleStudent[field].length > 0, `${field} should not be blank`);
  }

  const reenrollment = await request(
    "POST",
    `/api/students/${testStudent.studentId}/reenroll`,
    {},
    adminToken,
  );
  assert.equal(reenrollment.status, 200, JSON.stringify(reenrollment.data));
  assert.ok(reenrollment.data.enrollmentsCreated > 0);

  const studentEnrollments = await request(
    "GET",
    `/api/enrollments?studentId=${testStudent.studentId}`,
    undefined,
    testStudentToken,
  );
  assert.equal(studentEnrollments.status, 200);
  assert.equal(typeof studentEnrollments.data.data[0].programName, "string");
  assert.ok(studentEnrollments.data.data[0].programName.length > 0);

  const facultyLogin = await login(testFaculty.email);
  assert.equal(facultyLogin.status, 200);
  const attendanceBody = {
    studentId: testStudent.studentId,
    subjectOfferingId: selectedOffering.id,
    date: "2026-10-02",
    status: "present",
  };
  const attendance = await request(
    "POST",
    "/api/attendance",
    attendanceBody,
    facultyLogin.data.token,
  );
  assert.equal(attendance.status, 201, JSON.stringify(attendance.data));
  const attendanceUpdate = await request(
    "POST",
    "/api/attendance",
    { ...attendanceBody, status: "late" },
    facultyLogin.data.token,
  );
  assert.equal(attendanceUpdate.status, 200);
  assert.equal(attendanceUpdate.data.id, attendance.data.id);
  const invalidAttendance = await request(
    "POST",
    "/api/attendance",
    { ...attendanceBody, status: "unknown" },
    facultyLogin.data.token,
  );
  assert.equal(invalidAttendance.status, 400);
  const facultyOwnershipDenied = await request(
    "POST",
    "/api/attendance",
    attendanceBody,
    otherFacultyToken,
  );
  assert.equal(facultyOwnershipDenied.status, 403);
  const unassignedStudentDenied = await request(
    "POST",
    "/api/attendance",
    { ...attendanceBody, studentId: otherStudent.studentId },
    facultyLogin.data.token,
  );
  assert.equal(unassignedStudentDenied.status, 403);
  const privateAttendanceDenied = await request(
    "GET",
    `/api/attendance?studentId=${otherStudent.studentId}`,
    undefined,
    testStudentToken,
  );
  assert.equal(privateAttendanceDenied.status, 403);

  const gradeDb = openTestDatabase();
  const studentRow = await dbGet(gradeDb, "SELECT id FROM students WHERE studentId = ?", [
    testStudent.studentId,
  ]);
  await dbRun(
    gradeDb,
    `INSERT INTO grades (id, studentId, subjectOfferingId, grade, period, type, status, submittedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      studentRow.id,
      selectedOffering.id,
      88,
      "overall",
      "overall",
      "submitted",
      Date.now(),
    ],
  );
  await closeDatabase(gradeDb);

  const studentCannotFinalize = await request(
    "POST",
    `/api/students/${testStudent.studentId}/finalize-records`,
    {},
    testStudentToken,
  );
  assert.equal(studentCannotFinalize.status, 403);
  const invalidPeriod = await request(
    "POST",
    `/api/students/${testStudent.studentId}/finalize-records`,
    { period: "invalid" },
    adminToken,
  );
  assert.equal(invalidPeriod.status, 400);
  const finalized = await request(
    "POST",
    `/api/students/${testStudent.studentId}/finalize-records`,
    {},
    adminToken,
  );
  assert.equal(finalized.status, 200);
  assert.equal(finalized.data.finalizedCount, 1);
  const finalizedAgain = await request(
    "POST",
    `/api/students/${testStudent.studentId}/finalize-records`,
    {},
    adminToken,
  );
  assert.equal(finalizedAgain.data.finalizedCount, 0);

  const dbCheck = openTestDatabase();
  const finalizedGrade = await dbGet(
    dbCheck,
    "SELECT status FROM grades WHERE studentId = ? AND subjectOfferingId = ?",
    [studentRow.id, selectedOffering.id],
  );
  assert.equal(finalizedGrade.status, "finalized");
  await closeDatabase(dbCheck);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const failedLogin = await login("phase2-rate-limit@example.test", "wrong-password");
    assert.equal(failedLogin.status, 401);
    assert.deepEqual(failedLogin.data, { error: "Invalid credentials" });
  }
  const rateLimitedLogin = await login("phase2-rate-limit@example.test", "wrong-password");
  assert.equal(rateLimitedLogin.status, 429);
  assert.equal((await login(adminEmail)).status, 200);
});

test("administrator analytics uses database-backed counts and enforces administrator access", async () => {
  const missingToken = await request("GET", "/api/dashboard/analytics");
  assert.equal(missingToken.status, 401);

  const studentDenied = await request(
    "GET",
    "/api/dashboard/analytics",
    undefined,
    testStudentToken,
  );
  assert.equal(studentDenied.status, 403);

  const scenarioDb = openTestDatabase();
  await dbRun(scenarioDb, "UPDATE students SET status = 'approved' WHERE studentId = ?", [
    otherStudent.studentId,
  ]);
  const inactiveStudentAccount = await dbGet(
    scenarioDb,
    `SELECT u.id
     FROM students s
     JOIN users u ON u.id = s.userId
     WHERE s.studentId != ?
       AND s.status IN ('approved', 'active')
       AND u.role = 'student'
       AND u.status = 'active'
     LIMIT 1`,
    [otherStudent.studentId],
  );
  assert.ok(inactiveStudentAccount, "the isolated database copy must contain an active student");
  await dbRun(scenarioDb, "UPDATE users SET status = 'inactive' WHERE id = ?", [
    inactiveStudentAccount.id,
  ]);
  await closeDatabase(scenarioDb);

  const analyticsResponse = await request("GET", "/api/dashboard/analytics", undefined, adminToken);
  assert.equal(analyticsResponse.status, 200);
  assert.deepEqual(Object.keys(analyticsResponse.data).sort(), [
    "activeFaculty",
    "registrars",
    "studentsByProgram",
    "subjectOfferings",
    "totalStudents",
  ]);

  const analytics = analyticsResponse.data;
  const programNames = [
    "Diploma in Hospitality Services and Technology",
    "Diploma in Tourism and Travel Services",
    "Diploma in Multimedia Arts and Design",
    "Diploma in Industrial Education (Major in Hotel and Restaurant Services)",
    "Diploma in Industrial Education (Major in Multimedia Arts and Design)",
    "Unassigned",
  ];
  assert.deepEqual(
    analytics.studentsByProgram.map((entry) => entry.program).sort(),
    programNames.sort(),
  );
  assert.ok(analytics.studentsByProgram.every((entry) => Number.isInteger(entry.count)));
  assert.equal(
    analytics.studentsByProgram.reduce((sum, entry) => sum + entry.count, 0),
    analytics.totalStudents,
  );
  assert.equal(
    analytics.studentsByProgram.find((entry) => entry.program === "Unassigned")?.count,
    1,
    "approved students without an enrolled program must be assigned to Unassigned",
  );
  assert.ok(
    analytics.studentsByProgram.every(
      (entry) => Object.keys(entry).sort().join(",") === "count,program",
    ),
    "analytics must not expose student-level information",
  );

  const db = openTestDatabase();
  const expectedCounts = await dbGet(
    db,
    `SELECT
       (SELECT COUNT(DISTINCT s.id)
        FROM students s JOIN users u ON u.id = s.userId
        WHERE s.status IN ('approved', 'active')
          AND u.role = 'student' AND u.status = 'active') AS totalStudents,
       (SELECT COUNT(DISTINCT f.id)
        FROM faculty f JOIN users u ON u.id = f.userId
        WHERE f.status = 'active' AND u.role = 'faculty' AND u.status = 'active') AS activeFaculty,
       (SELECT COUNT(DISTINCT u.id)
        FROM users u WHERE u.role = 'registrar' AND u.status = 'active') AS registrars,
       (SELECT COUNT(DISTINCT o.id)
        FROM subjectOfferings o WHERE o.status = 'active') AS subjectOfferings`,
  );
  await closeDatabase(db);

  assert.equal(analytics.totalStudents, expectedCounts.totalStudents);
  assert.equal(analytics.activeFaculty, expectedCounts.activeFaculty);
  assert.equal(analytics.registrars, expectedCounts.registrars);
  assert.equal(analytics.subjectOfferings, expectedCounts.subjectOfferings);

  const [adminDashboard, registrarDashboard, studentReport, enrollmentReport, refreshed] =
    await Promise.all([
      request("GET", "/api/dashboard/admin", undefined, adminToken),
      request("GET", "/api/dashboard/registrar", undefined, adminToken),
      request("GET", "/api/reports/students", undefined, adminToken),
      request("GET", "/api/reports/enrollment", undefined, adminToken),
      request("GET", "/api/dashboard/analytics", undefined, adminToken),
    ]);
  assert.equal(adminDashboard.status, 200);
  assert.equal(registrarDashboard.status, 200);
  assert.equal(studentReport.status, 200);
  assert.equal(enrollmentReport.status, 200);
  assert.equal(adminDashboard.data.totalStudents, analytics.totalStudents);
  assert.equal(adminDashboard.data.activeFaculty, analytics.activeFaculty);
  assert.equal(adminDashboard.data.activeOfferings, analytics.subjectOfferings);
  assert.equal(registrarDashboard.data.activeStudents, analytics.totalStudents);
  assert.equal(registrarDashboard.data.totalSubjects, analytics.subjectOfferings);
  assert.equal(studentReport.data.length, analytics.totalStudents);
  assert.deepEqual(refreshed.data, analytics);
  assert.equal(
    Object.values(enrollmentReport.data.byProgram).reduce((sum, count) => sum + count, 0),
    enrollmentReport.data.totalEnrolled,
    "the enrollment report groups enrollment rows, not distinct students",
  );
  assert.ok(!("Unknown" in enrollmentReport.data.byProgram));
});
