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

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDatabase = path.join(backendDir, "piat.db");
const jwtSecret = "faculty_evaluation_isolated_test_secret_2026";
const password = "Faculty-Evaluation-Test-2026!";
let tempDir;
let databasePath;
let baseUrl;
let serverProcess;
let adminToken;
let selectedOffering;
let unrelatedOffering;
let evaluationId;
let students = [];
let facultyToken;
let otherFacultyToken;
let managedQuestionId;

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
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

async function waitForBackend() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/evaluations/periods`);
      if (response.status === 401) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Isolated evaluation-test backend did not become ready.");
}

async function createAccount(role, name) {
  const created = await request(
    "POST",
    "/api/users",
    {
      role,
      firstName: name,
      lastName: "EvaluationTest",
      email: `${name.toLowerCase()}.${crypto.randomUUID()}@example.test`,
      password,
    },
    adminToken,
  );
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const login = await request("POST", "/api/users/login", {
    email: created.data.email,
    password,
  });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  return { account: created.data, token: login.data.token };
}

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "piat-evaluations-"));
  databasePath = path.join(tempDir, "piat-evaluation-test.db");
  await copyFile(sourceDatabase, databasePath);

  const db = openTestDatabase();
  const admin = await dbGet(db, "SELECT id, email FROM users WHERE role = 'admin' LIMIT 1");
  assert.ok(admin, "the isolated database copy must contain an administrator account");
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
  await dbRun(db, "UPDATE users SET password = ?, status = 'active' WHERE id = ?", [
    passwordHash,
    admin.id,
  ]);
  selectedOffering = await dbGet(
    db,
    `SELECT id, academicYearId, semesterId
     FROM subjectOfferings
     WHERE EXISTS (SELECT 1 FROM enrollments WHERE subjectOfferingId = subjectOfferings.id)
     LIMIT 1`,
  );
  assert.ok(selectedOffering, "the isolated database copy must contain a subject offering");
  unrelatedOffering = await dbGet(
    db,
    "SELECT id FROM subjectOfferings WHERE id != ? LIMIT 1",
    [selectedOffering.id],
  );
  assert.ok(unrelatedOffering, "the isolated database copy must contain a second subject offering");
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
  const adminLogin = await request("POST", "/api/users/login", {
    email: admin.email,
    password,
  });
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.data));
  adminToken = adminLogin.data.token;

  const faculty = await createAccount("faculty", "EvaluationFaculty");
  otherFacultyToken = (await createAccount("faculty", "EvaluationOtherFaculty")).token;
  const facultyDb = openTestDatabase();
  const facultyRecord = await dbGet(facultyDb, "SELECT id FROM faculty WHERE userId = ?", [
    faculty.account.id,
  ]);
  assert.ok(facultyRecord);
  await dbRun(facultyDb, "UPDATE subjectOfferings SET facultyId = ? WHERE id = ?", [
    facultyRecord.id,
    selectedOffering.id,
  ]);
  await dbRun(facultyDb, "UPDATE subjectOfferings SET facultyId = NULL WHERE id != ?", [
    selectedOffering.id,
  ]);
  await dbRun(facultyDb, "DELETE FROM enrollments WHERE subjectOfferingId != ?", [
    selectedOffering.id,
  ]);
  await dbRun(facultyDb, "DELETE FROM enrollments WHERE subjectOfferingId = ?", [
    selectedOffering.id,
  ]);
  students = [];
  for (let index = 1; index <= 5; index += 1) {
    const student = await createAccount("student", `EvaluationStudent${index}`);
    const studentRow = await dbGet(facultyDb, "SELECT id FROM students WHERE userId = ?", [
      student.account.id,
    ]);
    assert.ok(studentRow);
    await dbRun(
      facultyDb,
      `INSERT INTO enrollments (id, studentId, subjectOfferingId, status, enrolledAt)
       VALUES (?, ?, ?, 'enrolled', ?)`,
      [crypto.randomUUID(), studentRow.id, selectedOffering.id, Date.now()],
    );
    students.push({ ...student, studentUuid: studentRow.id });
  }
  await closeDatabase(facultyDb);
  facultyToken = faculty.token;

  const createdPeriod = await request(
    "POST",
    "/api/evaluations/periods",
    {
      title: "Evaluation isolation test",
      academicYearId: selectedOffering.academicYearId,
      semesterId: selectedOffering.semesterId,
      startDate: "2000-01-01",
      endDate: "2099-12-31",
    },
    adminToken,
  );
  assert.equal(createdPeriod.status, 201, JSON.stringify(createdPeriod.data));
  evaluationId = createdPeriod.data.id;
  const categories = await request("GET", "/api/evaluations/criteria", undefined, adminToken);
  assert.equal(categories.status, 200);
  const newQuestion = await request(
    "POST",
    "/api/evaluations/questions",
    {
      criteriaId: categories.data[0].id,
      questionText: "The faculty member supports student learning.",
      isRequired: true,
    },
    adminToken,
  );
  assert.equal(newQuestion.status, 201, JSON.stringify(newQuestion.data));
  managedQuestionId = newQuestion.data.id;
  const activated = await request(
    "PUT",
    `/api/evaluations/periods/${evaluationId}`,
    { status: "active" },
    adminToken,
  );
  assert.equal(activated.status, 200, JSON.stringify(activated.data));
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

test("faculty evaluations enforce enrollment, anonymity, aggregation, and role permissions", async () => {
  const unauthenticated = await request("GET", "/api/evaluations/reports");
  assert.equal(unauthenticated.status, 401);
  const unauthorizedStudent = await request(
    "GET",
    "/api/evaluations/reports",
    undefined,
    students[0].token,
  );
  assert.equal(unauthorizedStudent.status, 403);
  const forbiddenManagement = await request(
    "POST",
    "/api/evaluations/periods",
    { title: "Unauthorized" },
    students[0].token,
  );
  assert.equal(forbiddenManagement.status, 403);
  const forbiddenQuestionManagement = await request(
    "POST",
    "/api/evaluations/questions",
    { criteriaId: "criteria-teaching", questionText: "Unauthorized question" },
    students[0].token,
  );
  assert.equal(forbiddenQuestionManagement.status, 403);
  const activeQuestionChange = await request(
    "PUT",
    `/api/evaluations/questions/${managedQuestionId}`,
    { isActive: false },
    adminToken,
  );
  assert.equal(activeQuestionChange.status, 409);

  const periods = await request("GET", "/api/evaluations/periods", undefined, students[0].token);
  assert.equal(periods.status, 200);
  assert.equal(periods.data.length, 1);
  const questionResponse = await request(
    "GET",
    `/api/evaluations/periods/${evaluationId}/questions`,
    undefined,
    students[0].token,
  );
  assert.equal(questionResponse.status, 200);
  const questions = questionResponse.data;
  assert.ok(questions.length >= 12);
  const answersFor = (rating) =>
    questions.map((question) => ({ questionId: question.questionId, rating }));
  const submission = (student, answers, subjectOfferingId = selectedOffering.id) =>
    request(
      "POST",
      "/api/evaluations/submit",
      { evaluationId, subjectOfferingId, answers },
      student.token,
    );

  const unauthorizedOffering = await request(
    "POST",
    "/api/evaluations/submit",
    {
      evaluationId,
      subjectOfferingId: unrelatedOffering.id,
      answers: answersFor(4),
    },
    students[0].token,
  );
  assert.equal(unauthorizedOffering.status, 403);
  const missingRequired = await submission(students[0], answersFor(4).slice(1));
  assert.equal(missingRequired.status, 400);
  const invalidRating = await submission(students[0], [
    ...answersFor(4).slice(1),
    { questionId: questions[0].questionId, rating: 6 },
  ]);
  assert.equal(invalidRating.status, 400);

  for (let index = 0; index < 4; index += 1) {
    const response = await submission(students[index], answersFor(index + 1));
    assert.equal(response.status, 201, JSON.stringify(response.data));
    assert.deepEqual(response.data, { success: true, completed: true });
    const duplicate = await submission(students[index], answersFor(index + 1));
    assert.equal(duplicate.status, 409);
  }

  const protectedBeforeThreshold = await request(
    "GET",
    `/api/evaluations/reports?evaluationId=${evaluationId}`,
    undefined,
    adminToken,
  );
  assert.equal(protectedBeforeThreshold.status, 200);
  assert.deepEqual(protectedBeforeThreshold.data.groups, []);
  assert.equal(protectedBeforeThreshold.data.completion[0].suppressed, true);
  const registrarToken = (await createAccount("registrar", "EvaluationRegistrar")).token;
  const registrarReport = await request(
    "GET",
    `/api/evaluations/reports?evaluationId=${evaluationId}`,
    undefined,
    registrarToken,
  );
  assert.equal(registrarReport.status, 200);
  assert.doesNotMatch(JSON.stringify(registrarReport.data), /EvaluationStudent/i);
  const anotherStudentStatus = await request(
    "GET",
    `/api/evaluations/eligible?studentId=${encodeURIComponent(students[0].account.studentId)}`,
    undefined,
    students[4].token,
  );
  assert.equal(anotherStudentStatus.status, 200);
  assert.equal(anotherStudentStatus.data[0].completed, 0);

  const fifthResponse = await submission(students[4], answersFor(5));
  assert.equal(fifthResponse.status, 201, JSON.stringify(fifthResponse.data));
  const report = await request(
    "GET",
    `/api/evaluations/reports?evaluationId=${evaluationId}`,
    undefined,
    adminToken,
  );
  assert.equal(report.status, 200);
  assert.equal(report.data.groups.length, 1);
  assert.equal(report.data.groups[0].responseCount, 5);
  assert.equal(report.data.groups[0].overallAverage, 3);
  assert.ok(report.data.groups[0].categories.every((category) => category.average === 3));
  assert.equal(report.data.completion[0].eligibleCount, 5);
  assert.equal(report.data.completion[0].completedCount, 5);
  assert.equal(report.data.completion[0].percentage, 100);
  assert.doesNotMatch(JSON.stringify(report.data), /EvaluationStudent/i);
  assert.equal(Object.hasOwn(report.data.groups[0], "studentId"), false);

  const facultyResults = await request(
    "GET",
    "/api/evaluations/my-results",
    undefined,
    facultyToken,
  );
  assert.equal(facultyResults.status, 200);
  assert.equal(facultyResults.data.groups.length, 1);
  const otherFacultyResults = await request(
    "GET",
    "/api/evaluations/my-results",
    undefined,
    otherFacultyToken,
  );
  assert.equal(otherFacultyResults.status, 200);
  assert.deepEqual(otherFacultyResults.data.groups, []);
  const studentCannotReadFacultyResults = await request(
    "GET",
    "/api/evaluations/my-results",
    undefined,
    students[0].token,
  );
  assert.equal(studentCannotReadFacultyResults.status, 403);
  const studentCannotSeeAnotherStudentStatus = await request(
    "GET",
    "/api/evaluations/eligible",
    undefined,
    students[0].token,
  );
  assert.equal(studentCannotSeeAnotherStudentStatus.status, 200);
  assert.equal(studentCannotSeeAnotherStudentStatus.data[0].completed, 1);
  assert.equal(
    Object.hasOwn(studentCannotSeeAnotherStudentStatus.data[0], "studentId"),
    false,
  );

  const closed = await request(
    "PUT",
    `/api/evaluations/periods/${evaluationId}`,
    { status: "closed" },
    adminToken,
  );
  assert.equal(closed.status, 200);
  const historicalStatus = await request(
    "GET",
    "/api/evaluations/eligible",
    undefined,
    students[0].token,
  );
  assert.equal(historicalStatus.status, 200);
  assert.equal(historicalStatus.data[0].completed, 1);
  assert.equal(historicalStatus.data[0].canSubmit, false);
  const rejectedClosedPeriod = await submission(students[0], answersFor(3));
  assert.equal(rejectedClosedPeriod.status, 409);
});

test("evaluation response schema contains no student identity or participation foreign key", async () => {
  const db = openTestDatabase();
  const responseColumns = await new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(evaluation_responses)", (error, rows) =>
      error ? reject(error) : resolve(rows),
    );
  });
  const participationColumns = await new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(evaluation_participation)", (error, rows) =>
      error ? reject(error) : resolve(rows),
    );
  });
  assert.equal(responseColumns.some((column) => /student|participation/i.test(column.name)), false);
  assert.equal(participationColumns.some((column) => /response/i.test(column.name)), false);
  const integrity = await dbGet(db, "PRAGMA integrity_check");
  assert.equal(integrity.integrity_check, "ok");
  await closeDatabase(db);
});
