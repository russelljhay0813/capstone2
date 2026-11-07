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
const jwtSecret = "google_forms_evaluation_test_secret_2026";
const password = "Google-Evaluation-Test-2026!";
let tempDir;
let databasePath;
let baseUrl;
let serverProcess;
let adminToken;
let studentToken;
let selectedOffering;

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
  const isJson = response.headers.get("content-type")?.includes("application/json");
  return {
    status: response.status,
    data: text ? (isJson ? JSON.parse(text) : text) : null,
  };
}

async function waitForBackend() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/evaluations/status`);
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
      lastName: "FormsTest",
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
  tempDir = await mkdtemp(path.join(os.tmpdir(), "piat-google-evaluations-"));
  databasePath = path.join(tempDir, "piat-google-evaluation-test.db");
  await copyFile(sourceDatabase, databasePath);

  const db = new sqlite3.Database(databasePath);
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
    `SELECT o.id, o.academicYearId, ay.code AS academicYear,
            o.semesterId, sem.name AS semester
     FROM subjectOfferings o
     JOIN academicYears ay ON ay.id = o.academicYearId
     JOIN semesters sem ON sem.id = o.semesterId
     LIMIT 1`,
  );
  assert.ok(selectedOffering, "the isolated database copy must contain an academic offering");
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
      GOOGLE_EVALUATION_FORM_URL: "https://docs.google.com/forms/d/e/test-form-id/viewform",
      GOOGLE_EVALUATION_SPREADSHEET_ID: "",
      GOOGLE_EVALUATION_SERVICE_ACCOUNT_EMAIL: "",
      GOOGLE_EVALUATION_SERVICE_ACCOUNT_PRIVATE_KEY: "",
      GOOGLE_EVALUATION_ACADEMIC_YEAR: selectedOffering.academicYear,
      GOOGLE_EVALUATION_SEMESTER: selectedOffering.semester,
      GOOGLE_EVALUATION_START_DATE: "2000-01-01",
      GOOGLE_EVALUATION_END_DATE: "2099-12-31",
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
  const faculty = await createAccount("faculty", "GoogleEvaluationFaculty");
  const student = await createAccount("student", "EvaluationStudent");
  studentToken = student.token;
  const linkedDb = new sqlite3.Database(databasePath);
  const facultyRow = await dbGet(linkedDb, "SELECT id FROM faculty WHERE userId = ?", [
    faculty.account.id,
  ]);
  const studentRow = await dbGet(linkedDb, "SELECT id FROM students WHERE userId = ?", [
    student.account.id,
  ]);
  assert.ok(facultyRow);
  assert.ok(studentRow);
  await dbRun(linkedDb, "UPDATE subjectOfferings SET facultyId = ? WHERE id = ?", [
    facultyRow.id,
    selectedOffering.id,
  ]);
  await dbRun(
    linkedDb,
    `INSERT INTO enrollments (id, studentId, subjectOfferingId, status, enrolledAt)
     VALUES (?, ?, ?, 'enrolled', ?)`,
    [crypto.randomUUID(), studentRow.id, selectedOffering.id, Date.now()],
  );
  await closeDatabase(linkedDb);
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await Promise.race([
      new Promise((resolve) => serverProcess.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("evaluation dashboards use Google Workspace and remain role protected", async () => {
  const unauthenticated = await request("GET", "/api/evaluations/status");
  assert.equal(unauthenticated.status, 401);

  const status = await request("GET", "/api/evaluations/status", undefined, adminToken);
  assert.equal(status.status, 200, JSON.stringify(status.data));
  assert.equal(status.data.formConfigured, true);
  assert.equal(status.data.sheetsConfigured, false);
  assert.equal(status.data.periodConfigured, true);
  assert.equal(status.data.completionTrackingAvailable, false);
  assert.equal(status.data.totalResponses, null);
  assert.equal(status.data.formUrl, "https://docs.google.com/forms/d/e/test-form-id/viewform");
  assert.equal("privateKey" in status.data, false);
  assert.equal("serviceAccountEmail" in status.data, false);

  const studentWorkspaceStatus = await request(
    "GET",
    "/api/evaluations/status",
    undefined,
    studentToken,
  );
  assert.equal(studentWorkspaceStatus.status, 403);

  const studentAssignments = await request(
    "GET",
    "/api/evaluations/student-assignments",
    undefined,
    studentToken,
  );
  assert.equal(studentAssignments.status, 200);
  assert.equal(studentAssignments.data.period.status, "active");
  assert.equal(studentAssignments.data.assignments.length, 1);
  assert.equal(studentAssignments.data.assignments[0].academicYear, selectedOffering.academicYear);
  assert.equal(studentAssignments.data.formUrl, status.data.formUrl);
  assert.equal("studentId" in studentAssignments.data.assignments[0], false);
  assert.equal("email" in studentAssignments.data.assignments[0], false);
  assert.equal(studentAssignments.data.completionTrackingAvailable, false);

  const studentReports = await request(
    "GET",
    "/api/evaluations/reports",
    undefined,
    studentToken,
  );
  assert.equal(studentReports.status, 403);

  const unavailableReports = await request(
    "GET",
    "/api/evaluations/reports",
    undefined,
    adminToken,
  );
  assert.equal(unavailableReports.status, 503);

  const localQuestionnaire = await request(
    "POST",
    "/api/evaluations/submit",
    { answers: [{ questionId: "local", rating: 5 }] },
    studentToken,
  );
  assert.equal(localQuestionnaire.status, 404);
});
