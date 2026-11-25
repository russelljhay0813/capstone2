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
import { FACULTY_EVALUATION_QUESTIONNAIRE } from "../faculty-evaluation-questionnaire.js";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jwtSecret = "faculty_evaluation_isolated_test_secret_2026";
const adminPassword = "admin123";
const password = "Faculty-Evaluation-Test-2026!";
let tempDir;
let databasePath;
let baseUrl;
let serverProcess;
let adminToken;
let selectedOffering;
let unrelatedOffering;
let evaluationId;
let separateSemesterEvaluationId;
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
  const deadline = Date.now() + 60000;
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
  const db = openTestDatabase();
  const admin = await dbGet(db, "SELECT id, email FROM users WHERE role = 'admin' LIMIT 1");
  assert.ok(admin, "the synthetic database must contain its seeded administrator account");
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
  await dbRun(db, "UPDATE users SET password = ?, status = 'active' WHERE id = ?", [
    passwordHash,
    admin.id,
  ]);
  const academicYear = await dbGet(db, "SELECT id FROM academicYears ORDER BY code LIMIT 1");
  const semester = await dbGet(
    db,
    "SELECT id FROM semesters WHERE academicYearId = ? AND sequence = 1 LIMIT 1",
    [academicYear.id],
  );
  const program = await dbGet(db, "SELECT id FROM programs ORDER BY name LIMIT 1");
  const subjects = await new Promise((resolve, reject) => {
    db.all("SELECT id FROM subjects ORDER BY code LIMIT 2", (error, rows) =>
      error ? reject(error) : resolve(rows),
    );
  });
  assert.ok(academicYear && semester && program && subjects.length === 2);
  const sectionId = crypto.randomUUID();
  await dbRun(
    db,
    `INSERT INTO sections
     (id, code, name, programId, yearLevel, semesterId, academicYearId, status, createdAt)
     VALUES (?, ?, ?, ?, '1st Year', ?, ?, 'active', ?)`,
    [
      sectionId,
      `EVAL-TEST-${crypto.randomUUID()}`,
      "Evaluation Test Section",
      program.id,
      semester.id,
      academicYear.id,
      Date.now(),
    ],
  );
  selectedOffering = {
    id: crypto.randomUUID(),
    academicYearId: academicYear.id,
    semesterId: semester.id,
  };
  unrelatedOffering = { id: crypto.randomUUID() };
  for (const [offering, subject] of [
    [selectedOffering, subjects[0]],
    [unrelatedOffering, subjects[1]],
  ]) {
    await dbRun(
      db,
      `INSERT INTO subjectOfferings
       (id, subjectId, academicYearId, semesterId, sectionId, schedule, room, status, createdAt)
       VALUES (?, ?, ?, ?, ?, 'TBA', 'TBA', 'active', ?)`,
      [
        offering.id,
        subject.id,
        selectedOffering.academicYearId,
        selectedOffering.semesterId,
        sectionId,
        Date.now(),
      ],
    );
  }
  await closeDatabase(db);

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
  assert.ok(evaluationId);
  assert.equal(createdPeriod.data.status, "draft");
  assert.equal(createdPeriod.data.academicYearId, selectedOffering.academicYearId);
  assert.equal(createdPeriod.data.semesterId, selectedOffering.semesterId);
  assert.equal(createdPeriod.data.startDate, "2000-01-01");
  assert.equal(createdPeriod.data.endDate, "2099-12-31");
  const periodDb = openTestDatabase();
  const persistedPeriod = await dbGet(
    periodDb,
    `SELECT id, academicYearId, semesterId, startDate, endDate, status
     FROM faculty_evaluations WHERE id = ?`,
    [evaluationId],
  );
  await closeDatabase(periodDb);
  assert.deepEqual(persistedPeriod, {
    id: evaluationId,
    academicYearId: selectedOffering.academicYearId,
    semesterId: selectedOffering.semesterId,
    startDate: "2000-01-01",
    endDate: "2099-12-31",
    status: "draft",
  });
  const duplicatePeriod = await request(
    "POST",
    "/api/evaluations/periods",
    {
      academicYearId: selectedOffering.academicYearId,
      semesterId: selectedOffering.semesterId,
      startDate: "2000-01-01",
      endDate: "2099-12-31",
    },
    adminToken,
  );
  assert.equal(duplicatePeriod.status, 409);

  const semesterDb = openTestDatabase();
  const otherSemester = await dbGet(
    semesterDb,
    `SELECT id FROM semesters
     WHERE academicYearId = ? AND sequence IN (1, 2) AND id != ?
       AND NOT EXISTS (
         SELECT 1 FROM faculty_evaluations
         WHERE academicYearId = ? AND semesterId = semesters.id
       )
     LIMIT 1`,
    [selectedOffering.academicYearId, selectedOffering.semesterId, selectedOffering.academicYearId],
  );
  await closeDatabase(semesterDb);
  assert.ok(otherSemester, "the synthetic academic year must contain a second evaluation semester");
  const separateSemesterPeriod = await request(
    "POST",
    "/api/evaluations/periods",
    {
      academicYearId: selectedOffering.academicYearId,
      semesterId: otherSemester.id,
      startDate: "2000-01-01",
      endDate: "2099-12-31",
    },
    adminToken,
  );
  assert.equal(separateSemesterPeriod.status, 201, JSON.stringify(separateSemesterPeriod.data));
  separateSemesterEvaluationId = separateSemesterPeriod.data.id;
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
  assert.equal(questions.length, 18);
  assert.deepEqual(
    [...new Set(questions.map((question) => question.category))],
    FACULTY_EVALUATION_QUESTIONNAIRE.map((category) => category.name),
  );
  assert.deepEqual(
    questions.map((question) => question.questionText),
    FACULTY_EVALUATION_QUESTIONNAIRE.flatMap((category) => category.questions),
  );
  const eligible = await request("GET", "/api/evaluations/eligible", undefined, students[0].token);
  assert.equal(eligible.status, 200);
  assert.equal(eligible.data.length, 1);
  assert.equal(eligible.data[0].subjectOfferingId, selectedOffering.id);
  const answersFor = (rating) =>
    questions.map((question) => ({ questionId: question.questionId, rating }));
  const submission = (student, answers, subjectOfferingId = selectedOffering.id, comments = {}) =>
    request(
      "POST",
      "/api/evaluations/submit",
      { evaluationId, subjectOfferingId, answers, ...comments },
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
    const response = await submission(
      students[index],
      answersFor(index + 1),
      selectedOffering.id,
      index === 0
        ? {
            facultyStrengths: "confidential strengths",
            areasForImprovement: "confidential improvement",
            additionalComments: "confidential suggestion",
          }
        : {},
    );
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
  assert.equal(report.data.groups[0].categories.length, 6);
  assert.ok(report.data.groups[0].categories.every((category) => category.average === 3));
  assert.equal(report.data.completion[0].eligibleCount, 5);
  assert.equal(report.data.completion[0].completedCount, 5);
  assert.equal(report.data.completion[0].percentage, 100);
  assert.doesNotMatch(JSON.stringify(report.data), /EvaluationStudent/i);
  assert.doesNotMatch(JSON.stringify(report.data), /confidential/i);
  assert.equal(Object.hasOwn(report.data.groups[0], "studentId"), false);

  const facultyResults = await request(
    "GET",
    "/api/evaluations/my-results",
    undefined,
    facultyToken,
  );
  assert.equal(facultyResults.status, 200);
  assert.equal(facultyResults.data.groups.length, 1);
  const facultyDb = openTestDatabase();
  const otherFaculty = await dbGet(
    facultyDb,
    "SELECT id FROM faculty WHERE userId = (SELECT id FROM users WHERE email LIKE 'evaluationotherfaculty.%' LIMIT 1)",
  );
  await closeDatabase(facultyDb);
  assert.ok(otherFaculty);
  const facultyCannotChangeResultOwner = await request(
    "GET",
    `/api/evaluations/my-results?facultyId=${encodeURIComponent(otherFaculty.id)}`,
    undefined,
    facultyToken,
  );
  assert.equal(facultyCannotChangeResultOwner.status, 200);
  assert.equal(facultyCannotChangeResultOwner.data.groups.length, 1);
  assert.equal(facultyCannotChangeResultOwner.data.groups[0].responseCount, 5);
  const noIndividualResponseEndpoint = await fetch(`${baseUrl}/api/evaluations/responses`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  assert.match(noIndividualResponseEndpoint.headers.get("content-type") || "", /text\/html/);
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
  const answerCount = await dbGet(db, "SELECT COUNT(*) AS count FROM evaluation_answers");
  assert.equal(answerCount.count, 90);
  const savedComments = await dbGet(
    db,
    `SELECT facultyStrengths, areasForImprovement, additionalComments
     FROM evaluation_responses
     WHERE evaluationId = ? LIMIT 1`,
    [evaluationId],
  );
  assert.deepEqual(savedComments, {
    facultyStrengths: "confidential strengths",
    areasForImprovement: "confidential improvement",
    additionalComments: "confidential suggestion",
  });
  const semesterPeriods = await dbGet(
    db,
    `SELECT COUNT(*) AS count FROM faculty_evaluations
     WHERE id IN (?, ?) AND academicYearId = ?`,
    [evaluationId, separateSemesterEvaluationId, selectedOffering.academicYearId],
  );
  assert.equal(semesterPeriods.count, 2);
  const integrity = await dbGet(db, "PRAGMA integrity_check");
  assert.equal(integrity.integrity_check, "ok");
  await closeDatabase(db);
});

test("student eligibility hides unavailable periods and preserves completed history", async () => {
  const student = await createAccount("student", "EvaluationNoEnrollment");
  const db = openTestDatabase();
  const studentRow = await dbGet(db, "SELECT id FROM students WHERE userId = ?", [
    student.account.id,
  ]);
  assert.ok(studentRow);
  const noEnrollmentResult = await request(
    "GET",
    "/api/evaluations/eligible",
    undefined,
    student.token,
  );
  assert.equal(noEnrollmentResult.status, 200);
  assert.deepEqual(noEnrollmentResult.data, []);

  await dbRun(
    db,
    `INSERT INTO enrollments (id, studentId, subjectOfferingId, status, enrolledAt)
     VALUES (?, ?, ?, 'enrolled', ?)`,
    [crypto.randomUUID(), studentRow.id, selectedOffering.id, Date.now()],
  );
  const faculty = await dbGet(db, "SELECT facultyId FROM subjectOfferings WHERE id = ?", [
    selectedOffering.id,
  ]);
  assert.ok(faculty?.facultyId);
  await dbRun(db, "UPDATE subjectOfferings SET facultyId = ? WHERE id = ?", [
    faculty.facultyId,
    unrelatedOffering.id,
  ]);
  await dbRun(
    db,
    `INSERT INTO enrollments (id, studentId, subjectOfferingId, status, enrolledAt)
     VALUES (?, ?, ?, 'enrolled', ?)`,
    [crypto.randomUUID(), studentRow.id, unrelatedOffering.id, Date.now()],
  );
  await dbRun(
    db,
    "UPDATE faculty_evaluations SET status = 'active', startDate = '2000-01-01', endDate = '2099-12-31' WHERE id = ?",
    [separateSemesterEvaluationId],
  );
  for (const period of [
    { status: "draft", startDate: "2000-01-01", endDate: "2099-12-31" },
    { status: "closed", startDate: "2000-01-01", endDate: "2099-12-31" },
    { status: "active", startDate: "2000-01-01", endDate: "2000-01-02" },
  ]) {
    await dbRun(
      db,
      "UPDATE faculty_evaluations SET status = ?, startDate = ?, endDate = ? WHERE id = ?",
      [period.status, period.startDate, period.endDate, evaluationId],
    );
    const unavailable = await request(
      "GET",
      "/api/evaluations/eligible",
      undefined,
      student.token,
    );
    assert.equal(unavailable.status, 200);
    assert.deepEqual(unavailable.data, []);
  }

  await dbRun(
    db,
    "UPDATE faculty_evaluations SET status = 'active', startDate = '2000-01-01', endDate = '2099-12-31' WHERE id = ?",
    [evaluationId],
  );
  const pending = await request(
    "GET",
    "/api/evaluations/eligible",
    undefined,
    student.token,
  );
  assert.equal(pending.status, 200);
  assert.equal(pending.data.length, 2);
  assert.deepEqual(
    new Set(pending.data.map((assignment) => assignment.subjectOfferingId)),
    new Set([selectedOffering.id, unrelatedOffering.id]),
  );
  assert.ok(pending.data.every((assignment) => assignment.completed === 0));
  assert.ok(pending.data.every((assignment) => assignment.canSubmit));

  await dbRun(
    db,
    "UPDATE faculty_evaluations SET status = 'closed' WHERE id = ?",
    [evaluationId],
  );
  const completedHistory = await request(
    "GET",
    "/api/evaluations/eligible",
    undefined,
    students[0].token,
  );
  assert.equal(completedHistory.status, 200);
  assert.equal(completedHistory.data.length, 1);
  assert.equal(completedHistory.data[0].completed, 1);
  assert.equal(completedHistory.data[0].canSubmit, false);
  const integrity = await dbGet(db, "PRAGMA integrity_check");
  assert.equal(integrity.integrity_check, "ok");
  const foreignKeyViolations = await new Promise((resolve, reject) => {
    db.all("PRAGMA foreign_key_check", (error, rows) =>
      error ? reject(error) : resolve(rows),
    );
  });
  assert.deepEqual(foreignKeyViolations, []);
  await closeDatabase(db);
});

test("admin questionnaire drafts publish immutable questions for eligible student submissions", async () => {
  const db = openTestDatabase();
  const offeringContext = await dbGet(
    db,
    `SELECT ay.id AS academicYearId, ay.code, sem.id AS semesterId
     FROM academicYears ay
     JOIN semesters sem ON sem.academicYearId = ay.id AND sem.sequence = 1
     WHERE NOT EXISTS (
       SELECT 1 FROM faculty_evaluations ev
       WHERE ev.academicYearId = ay.id AND ev.semesterId = sem.id
     )
     LIMIT 1`,
  );
  const program = await dbGet(db, "SELECT id FROM programs ORDER BY name LIMIT 1");
  const subject = await dbGet(db, "SELECT id FROM subjects ORDER BY code LIMIT 1");
  const faculty = await dbGet(
    db,
    "SELECT facultyId FROM subjectOfferings WHERE id = ?",
    [selectedOffering.id],
  );
  assert.ok(offeringContext && program && subject && faculty?.facultyId);
  const sectionId = crypto.randomUUID();
  const subjectOfferingId = crypto.randomUUID();
  await dbRun(
    db,
    `INSERT INTO sections
     (id, code, name, programId, yearLevel, semesterId, academicYearId, status, createdAt)
     VALUES (?, ?, ?, ?, '1st Year', ?, ?, 'active', ?)`,
    [
      sectionId,
      `EVAL-PUBLISH-${crypto.randomUUID()}`,
      "Questionnaire Publish Test Section",
      program.id,
      offeringContext.semesterId,
      offeringContext.academicYearId,
      Date.now(),
    ],
  );
  await dbRun(
    db,
    `INSERT INTO subjectOfferings
     (id, subjectId, academicYearId, semesterId, sectionId, facultyId, schedule, room, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 'TBA', 'TBA', 'active', ?)`,
    [
      subjectOfferingId,
      subject.id,
      offeringContext.academicYearId,
      offeringContext.semesterId,
      sectionId,
      faculty.facultyId,
      Date.now(),
    ],
  );
  for (const student of students) {
    await dbRun(
      db,
      `INSERT INTO enrollments (id, studentId, subjectOfferingId, status, enrolledAt)
       VALUES (?, ?, ?, 'enrolled', ?)`,
      [crypto.randomUUID(), student.studentUuid, subjectOfferingId, Date.now()],
    );
  }
  await closeDatabase(db);

  const created = await request(
    "POST",
    "/api/evaluations/periods",
    {
      title: "Editable faculty questionnaire",
      academicYearId: offeringContext.academicYearId,
      semesterId: offeringContext.semesterId,
      startDate: "2000-01-01",
      endDate: "2099-12-31",
    },
    adminToken,
  );
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const customEvaluationId = created.data.id;
  const categories = [
    {
      name: "Course-specific criteria",
      questions: [
        {
          questionText: "The instructor explains the course objectives.",
          isRequired: true,
          questionType: "rating",
        },
        {
          questionText: "The instructor uses helpful learning materials.",
          isRequired: false,
          questionType: "rating",
        },
      ],
    },
  ];
  const ratingScale = [
    { value: 1, label: "Needs improvement" },
    { value: 2, label: "Below expectations" },
    { value: 3, label: "Meets expectations" },
    { value: 4, label: "Above expectations" },
    { value: 5, label: "Outstanding" },
  ];
  const saved = await request(
    "PUT",
    `/api/evaluations/periods/${customEvaluationId}/questionnaire`,
    { categories, ratingScale },
    adminToken,
  );
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.questions.length, 2);

  const beforePublish = await request(
    "GET",
    "/api/evaluations/eligible",
    undefined,
    students[0].token,
  );
  assert.equal(
    beforePublish.data.some((assignment) => assignment.evaluationId === customEvaluationId),
    false,
  );
  const hiddenQuestions = await request(
    "GET",
    `/api/evaluations/periods/${customEvaluationId}/questions?subjectOfferingId=${subjectOfferingId}`,
    undefined,
    students[0].token,
  );
  assert.equal(hiddenQuestions.status, 403);
  const studentCannotEdit = await request(
    "PUT",
    `/api/evaluations/periods/${customEvaluationId}/questionnaire`,
    { categories, ratingScale },
    students[0].token,
  );
  assert.equal(studentCannotEdit.status, 403);

  const optionalOnly = await request(
    "PUT",
    `/api/evaluations/periods/${customEvaluationId}/questionnaire`,
    {
      categories: [
        {
          name: categories[0].name,
          questions: [{ ...categories[0].questions[1], isRequired: false }],
        },
      ],
      ratingScale,
    },
    adminToken,
  );
  assert.equal(optionalOnly.status, 200);
  const rejectedPublication = await request(
    "PUT",
    `/api/evaluations/periods/${customEvaluationId}`,
    { status: "active" },
    adminToken,
  );
  assert.equal(rejectedPublication.status, 409);

  const restoredQuestionnaire = await request(
    "PUT",
    `/api/evaluations/periods/${customEvaluationId}/questionnaire`,
    { categories, ratingScale },
    adminToken,
  );
  assert.equal(restoredQuestionnaire.status, 200);
  const published = await request(
    "PUT",
    `/api/evaluations/periods/${customEvaluationId}`,
    { status: "active" },
    adminToken,
  );
  assert.equal(published.status, 200, JSON.stringify(published.data));
  assert.equal(published.data.questionnaireVersion, 1);
  const eligible = await request(
    "GET",
    "/api/evaluations/eligible",
    undefined,
    students[0].token,
  );
  assert.ok(eligible.data.some((assignment) => assignment.evaluationId === customEvaluationId));
  const studentQuestions = await request(
    "GET",
    `/api/evaluations/periods/${customEvaluationId}/questions?subjectOfferingId=${subjectOfferingId}`,
    undefined,
    students[0].token,
  );
  assert.equal(studentQuestions.status, 200, JSON.stringify(studentQuestions.data));
  assert.deepEqual(
    studentQuestions.data.map((question) => question.questionText),
    categories[0].questions.map((question) => question.questionText),
  );
  assert.deepEqual(studentQuestions.data[0].ratingScale, ratingScale);
  assert.equal(studentQuestions.data[0].isRequired, 1);
  assert.equal(studentQuestions.data[1].isRequired, 0);

  const changedDraft = await request(
    "PUT",
    `/api/evaluations/periods/${customEvaluationId}/questionnaire`,
    {
      categories: [{ name: "Changed after publication", questions: categories[0].questions }],
      ratingScale,
    },
    adminToken,
  );
  assert.equal(changedDraft.status, 409);

  for (const student of students) {
    const submitted = await request(
      "POST",
      "/api/evaluations/submit",
      {
        evaluationId: customEvaluationId,
        subjectOfferingId,
        answers: [{ questionId: studentQuestions.data[0].questionId, rating: 4 }],
      },
      student.token,
    );
    assert.equal(submitted.status, 201, JSON.stringify(submitted.data));
  }
  const report = await request(
    "GET",
    `/api/evaluations/reports?evaluationId=${customEvaluationId}`,
    undefined,
    adminToken,
  );
  assert.equal(report.status, 200);
  assert.equal(report.data.groups.length, 1);
  assert.equal(report.data.groups[0].responseCount, 5);
  assert.equal(report.data.groups[0].questions.length, 1);
  assert.equal(
    report.data.groups[0].questions[0].questionText,
    "The instructor explains the course objectives.",
  );
  const savedRecords = openTestDatabase();
  const answerCount = await dbGet(
    savedRecords,
    `SELECT COUNT(*) AS count
     FROM evaluation_answers a
     JOIN evaluation_responses r ON r.id = a.responseId
     WHERE r.evaluationId = ?`,
    [customEvaluationId],
  );
  const version = await dbGet(
    savedRecords,
    `SELECT version, questionnaireJson
     FROM evaluation_questionnaire_versions
     WHERE evaluationId = ?`,
    [customEvaluationId],
  );
  assert.equal(answerCount.count, 5);
  assert.equal(version.version, 1);
  assert.deepEqual(JSON.parse(version.questionnaireJson).questions.map((question) => question.questionText), [
    "The instructor explains the course objectives.",
    "The instructor uses helpful learning materials.",
  ]);
  const integrity = await dbGet(savedRecords, "PRAGMA integrity_check");
  assert.equal(integrity.integrity_check, "ok");
  await closeDatabase(savedRecords);
});

test("evaluation deletion is admin-only and preserves historical data while removing eligible periods", async () => {
  const unauthenticated = await request(
    "DELETE",
    `/api/evaluations/periods/${separateSemesterEvaluationId}`,
  );
  assert.equal(unauthenticated.status, 401);

  const unauthorizedStudent = await request(
    "DELETE",
    `/api/evaluations/periods/${separateSemesterEvaluationId}`,
    undefined,
    students[0].token,
  );
  assert.equal(unauthorizedStudent.status, 403);

  const protectedPeriod = await request(
    "DELETE",
    `/api/evaluations/periods/${evaluationId}`,
    undefined,
    adminToken,
  );
  assert.equal(protectedPeriod.status, 409);
  assert.match(protectedPeriod.data.error, /submitted responses or completion records/i);

  const db = openTestDatabase();
  const historicalCounts = await dbGet(
    db,
    `SELECT
       (SELECT COUNT(*) FROM evaluation_responses WHERE evaluationId = ?) AS responses,
       (SELECT COUNT(*) FROM evaluation_participation WHERE evaluationId = ?) AS participation`,
    [evaluationId, evaluationId],
  );
  assert.ok(historicalCounts.responses > 0);
  assert.ok(historicalCounts.participation > 0);

  const activePeriod = await dbGet(
    db,
    "SELECT id FROM faculty_evaluations WHERE status = 'active' LIMIT 1",
  );
  assert.ok(activePeriod);
  const activeDelete = await request(
    "DELETE",
    `/api/evaluations/periods/${activePeriod.id}`,
    undefined,
    adminToken,
  );
  assert.equal(activeDelete.status, 409);
  assert.match(activeDelete.data.error, /close the active evaluation period/i);
  await closeDatabase(db);

  const closedPeriod = await request(
    "PUT",
    `/api/evaluations/periods/${separateSemesterEvaluationId}`,
    { status: "closed" },
    adminToken,
  );
  assert.equal(closedPeriod.status, 200, JSON.stringify(closedPeriod.data));

  const configurationDb = openTestDatabase();
  const category = await dbGet(
    configurationDb,
    "SELECT id, name FROM evaluation_criteria ORDER BY displayOrder LIMIT 1",
  );
  const question = await dbGet(
    configurationDb,
    "SELECT id, questionText FROM evaluation_questions WHERE criteriaId = ? LIMIT 1",
    [category.id],
  );
  await dbRun(
    configurationDb,
    `INSERT INTO evaluation_period_categories
     (evaluationId, criteriaId, categoryName, description, categoryOrder)
     VALUES (?, ?, ?, NULL, 1)`,
    [separateSemesterEvaluationId, category.id, category.name],
  );
  await dbRun(
    configurationDb,
    `INSERT INTO evaluation_period_questions
     (evaluationId, questionId, criteriaId, categoryName, categoryOrder, questionText,
      questionOrder, isRequired, questionType)
     VALUES (?, ?, ?, ?, 1, ?, 1, 1, 'rating')`,
    [separateSemesterEvaluationId, question.id, category.id, category.name, question.questionText],
  );
  await dbRun(
    configurationDb,
    `INSERT INTO evaluation_questionnaire_versions
     (id, evaluationId, version, questionnaireJson, publishedAt)
     VALUES (?, ?, 1, '{}', ?)`,
    [crypto.randomUUID(), separateSemesterEvaluationId, Date.now()],
  );
  await closeDatabase(configurationDb);

  const deletedPeriod = await request(
    "DELETE",
    `/api/evaluations/periods/${separateSemesterEvaluationId}`,
    undefined,
    adminToken,
  );
  assert.equal(deletedPeriod.status, 200, JSON.stringify(deletedPeriod.data));

  const finalDb = openTestDatabase();
  const deletedConfigs = await dbGet(
    finalDb,
    `SELECT
       (SELECT COUNT(*) FROM evaluation_period_categories WHERE evaluationId = ?) AS categories,
       (SELECT COUNT(*) FROM evaluation_period_questions WHERE evaluationId = ?) AS questions,
       (SELECT COUNT(*) FROM evaluation_questionnaire_versions WHERE evaluationId = ?) AS versions`,
    [separateSemesterEvaluationId, separateSemesterEvaluationId, separateSemesterEvaluationId],
  );
  assert.deepEqual(deletedConfigs, { categories: 0, questions: 0, versions: 0 });
  const remainingSelected = await dbGet(
    finalDb,
    "SELECT id FROM faculty_evaluations WHERE id = ?",
    [evaluationId],
  );
  assert.equal(remainingSelected.id, evaluationId);
  await closeDatabase(finalDb);

  const periods = await request("GET", "/api/evaluations/periods", undefined, adminToken);
  assert.equal(periods.status, 200);
  assert.ok(periods.data.some((period) => period.id === evaluationId));
  assert.ok(!periods.data.some((period) => period.id === separateSemesterEvaluationId));
});
