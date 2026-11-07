import crypto from "crypto";
import { all as dbAll, get as dbGet } from "./db.js";

const MIN_REPORTING_RESPONSES = 5;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const QUESTION_TITLES = [
  "Explains subject concepts clearly.",
  "Demonstrates strong knowledge of the subject.",
  "Presents lessons in an organized and understandable way.",
  "Uses class time effectively.",
  "Maintains a respectful and orderly learning environment.",
  "Encourages constructive participation.",
  "Communicates expectations and instructions clearly.",
  "Listens to and responds respectfully to students.",
  "Demonstrates fairness and respect.",
  "Arrives prepared and conducts classes professionally.",
  "Treats students consistently and without favoritism.",
  "Demonstrates responsibility and integrity.",
  "Encourages students to participate in learning activities.",
  "Connects lessons to student interests or practical examples.",
  "Creates an inclusive and supportive learning environment.",
  "Uses assessments that align with course learning outcomes.",
  "Provides timely and useful feedback.",
  "Explains how students can improve their performance.",
];
const CATEGORY_NAMES = [
  "Teaching Effectiveness",
  "Classroom Management",
  "Communication",
  "Professionalism",
  "Student Engagement",
  "Assessment and Feedback",
];

class EvaluationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let cachedGoogleToken;

function asyncRoute(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      if (error instanceof EvaluationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      console.error("[faculty-evaluations] request failed:", error);
      res.status(500).json({ error: "Unable to process the faculty evaluation request." });
    });
  };
}

function googleConfiguration() {
  const formUrl = String(process.env.GOOGLE_EVALUATION_FORM_URL || "").trim();
  const spreadsheetId = String(process.env.GOOGLE_EVALUATION_SPREADSHEET_ID || "").trim();
  const serviceAccountEmail = String(process.env.GOOGLE_EVALUATION_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = String(process.env.GOOGLE_EVALUATION_SERVICE_ACCOUNT_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n")
    .trim();
  const formUrlIsValid = (() => {
    try {
      const url = new URL(formUrl);
      return url.protocol === "https:" &&
        ((url.hostname === "docs.google.com" && url.pathname.startsWith("/forms/")) ||
          url.hostname === "forms.gle");
    } catch {
      return false;
    }
  })();
  const spreadsheetIdIsValid = /^[\w-]+$/.test(spreadsheetId);

  return {
    formUrl: formUrlIsValid ? formUrl : null,
    spreadsheetId: spreadsheetIdIsValid ? spreadsheetId : null,
    serviceAccountEmail,
    privateKey,
    formConfigured: formUrlIsValid,
    sheetsConfigured: spreadsheetIdIsValid && Boolean(serviceAccountEmail && privateKey),
  };
}

function evaluationPeriodConfiguration() {
  const academicYear = String(process.env.GOOGLE_EVALUATION_ACADEMIC_YEAR || "").trim();
  const semester = String(process.env.GOOGLE_EVALUATION_SEMESTER || "").trim();
  const startDate = String(process.env.GOOGLE_EVALUATION_START_DATE || "").trim();
  const endDate = String(process.env.GOOGLE_EVALUATION_END_DATE || "").trim();
  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  };
  if (!academicYear || !semester || !validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    return null;
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    academicYear,
    semester,
    startDate,
    endDate,
    status: startDate <= today && endDate >= today
      ? "active"
      : today < startDate
        ? "upcoming"
        : "closed",
  };
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getGoogleAccessToken(configuration) {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) {
    return cachedGoogleToken.value;
  }
  let assertion;
  try {
    const now = Math.floor(Date.now() / 1000);
    const unsigned = [
      base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
      base64Url(JSON.stringify({
        iss: configuration.serviceAccountEmail,
        scope: GOOGLE_SHEETS_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        iat: now,
        exp: now + 3600,
      })),
    ].join(".");
    const signature = crypto
      .createSign("RSA-SHA256")
      .update(unsigned)
      .sign(configuration.privateKey, "base64url");
    assertion = `${unsigned}.${signature}`;
  } catch {
    throw new EvaluationError(503, "Google Sheets service-account credentials are invalid.");
  }

  let response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
  } catch {
    throw new EvaluationError(502, "Google authorization could not be reached.");
  }
  if (!response.ok) {
    console.error("[faculty-evaluations] Google OAuth returned status", response.status);
    throw new EvaluationError(503, "Google Sheets authorization failed; verify the service-account setup.");
  }
  const tokenData = await response.json();
  if (typeof tokenData.access_token !== "string" || !Number.isFinite(tokenData.expires_in)) {
    throw new EvaluationError(502, "Google authorization returned an invalid token response.");
  }
  cachedGoogleToken = {
    value: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  };
  return cachedGoogleToken.value;
}

async function readSummaryRows(configuration) {
  if (!configuration.sheetsConfigured) {
    throw new EvaluationError(503, "Google Sheets reporting is not configured.");
  }
  const token = await getGoogleAccessToken(configuration);
  const range = encodeURIComponent("'Evaluation Summary'!A1:AF");
  let response;
  try {
    response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(configuration.spreadsheetId)}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    throw new EvaluationError(502, "Google Sheets could not be reached.");
  }
  if (!response.ok) {
    console.error("[faculty-evaluations] Google Sheets API returned status", response.status);
    throw new EvaluationError(502, "Google Sheets could not be read; verify spreadsheet sharing and tab setup.");
  }
  const data = await response.json();
  if (!Array.isArray(data.values) || data.values.length === 0) return [];

  return data.values.slice(1).filter((row) =>
    Array.isArray(row) && row.some((value) => value !== "" && value !== null && value !== undefined),
  );
}

function numericValue(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new EvaluationError(502, `The Evaluation Summary sheet contains an invalid ${label} value.`);
  }
  return result;
}

function interpret(value) {
  if (value >= 4.5) return "Excellent";
  if (value >= 3.5) return "Very Satisfactory";
  if (value >= 2.5) return "Satisfactory";
  if (value >= 1.5) return "Fair";
  return "Poor";
}

function parseSummaryRow(row) {
  if (row.length < 32) {
    throw new EvaluationError(502, "The Evaluation Summary sheet does not match the PIAT report template.");
  }
  const facultyName = String(row[0] || "").trim();
  const subject = String(row[1] || "").trim();
  if (!facultyName || !subject) {
    throw new EvaluationError(502, "The Evaluation Summary sheet contains a row without faculty or subject.");
  }
  const questionAverages = QUESTION_TITLES.map((question, index) => ({
    question,
    average: numericValue(row[6 + index], "question average"),
  }));
  if (questionAverages.some(({ average }) => average < 1 || average > 5)) {
    throw new EvaluationError(502, "The Evaluation Summary sheet contains an out-of-range question average.");
  }
  const categories = CATEGORY_NAMES.map((category, index) => {
    const average = numericValue(row[24 + index], "category average");
    return {
      category,
      average,
      interpretation: interpret(Number(average.toFixed(2))),
    };
  });
  if (categories.some(({ average }) => average < 1 || average > 5)) {
    throw new EvaluationError(502, "The Evaluation Summary sheet contains an out-of-range category average.");
  }
  const overallAverage = numericValue(row[30], "overall average");
  if (overallAverage < 1 || overallAverage > 5) {
    throw new EvaluationError(502, "The Evaluation Summary sheet contains an out-of-range overall average.");
  }
  const responseCount = numericValue(row[5], "response count");
  if (!Number.isInteger(responseCount) || responseCount < 1) {
    throw new EvaluationError(502, "The Evaluation Summary sheet contains an invalid response count.");
  }
  return {
    facultyName,
    subject,
    academicYear: String(row[2] || ""),
    semester: String(row[3] || ""),
    programName: String(row[4] || ""),
    responseCount,
    questionAverages,
    categories,
    overallAverage,
    interpretation: interpret(Number(overallAverage.toFixed(2))),
  };
}

function filterReportGroups(groups, query) {
  const filters = [
    ["academicYear", "academicYear"],
    ["semester", "semester"],
    ["program", "programName"],
    ["faculty", "facultyName"],
    ["subject", "subject"],
  ];
  return groups.filter((group) => filters.every(([key, property]) => {
    const value = String(query[key] || "").trim();
    return !value || group[property] === value;
  }));
}

function makeReport(groups, query) {
  const allGroups = groups.map(parseSummaryRow);
  const filtered = filterReportGroups(allGroups, query);
  const reportableGroups = filtered
    .filter((group) => group.responseCount >= MIN_REPORTING_RESPONSES)
    .map((group) => ({
      ...group,
      overallAverage: Number(group.overallAverage.toFixed(2)),
      categories: group.categories.map((category) => ({
        ...category,
        average: Number(category.average.toFixed(2)),
      })),
      questionAverages: group.questionAverages.map((question) => ({
        ...question,
        average: Number(question.average.toFixed(2)),
      })),
    }));

  return {
    groups: reportableGroups,
    totalResponses: filtered.reduce((total, group) => total + group.responseCount, 0),
    filters: {
      academicYears: [...new Set(allGroups.map((group) => group.academicYear).filter(Boolean))].sort(),
      semesters: [...new Set(allGroups.map((group) => group.semester).filter(Boolean))].sort(),
      programs: [...new Set(allGroups.map((group) => group.programName).filter(Boolean))].sort(),
      faculty: [...new Set(allGroups.map((group) => group.facultyName).filter(Boolean))].sort(),
      subjects: [...new Set(allGroups.map((group) => group.subject).filter(Boolean))].sort(),
    },
  };
}

async function findStudent(db, identity) {
  return dbGet(
    db,
    "SELECT id FROM students WHERE userId = ? OR studentId = ? LIMIT 1",
    [identity.userId, identity.studentId],
  );
}

export function registerFacultyEvaluationRoutes(app, db, { requireRole }) {
  app.get(
    "/api/evaluations/status",
    requireRole("admin", "registrar"),
    asyncRoute(async (_req, res) => {
      const configuration = googleConfiguration();
      const period = evaluationPeriodConfiguration();
      let totalResponses = null;
      if (configuration.sheetsConfigured) {
        totalResponses = makeReport(await readSummaryRows(configuration), {}).totalResponses;
      }
      res.json({
        formConfigured: configuration.formConfigured,
        sheetsConfigured: configuration.sheetsConfigured,
        periodConfigured: Boolean(period),
        formUrl: configuration.formConfigured ? configuration.formUrl : null,
        spreadsheetUrl: configuration.spreadsheetId
          ? `https://docs.google.com/spreadsheets/d/${configuration.spreadsheetId}/edit`
          : null,
        period,
        totalResponses,
        completionTrackingAvailable: false,
      });
    }),
  );

  app.get(
    "/api/evaluations/student-assignments",
    requireRole("student"),
    asyncRoute(async (req, res) => {
      const configuration = googleConfiguration();
      const period = evaluationPeriodConfiguration();
      if (!period) {
        res.json({
          period: null,
          formUrl: configuration.formUrl,
          assignments: [],
          completionTrackingAvailable: false,
        });
        return;
      }
      const student = await findStudent(db, req.userContext);
      if (!student) throw new EvaluationError(403, "A linked student record is required.");
      const assignments = await dbAll(
        db,
        `SELECT DISTINCT ay.code AS academicYear, sem.name AS semester,
                f.firstName || ' ' || f.lastName AS facultyName,
                sub.code AS subjectCode, sub.title AS subjectTitle,
                p.name AS programName
         FROM enrollments e
         JOIN subjectOfferings o ON o.id = e.subjectOfferingId
         JOIN academicYears ay ON ay.id = o.academicYearId
         JOIN semesters sem ON sem.id = o.semesterId
         JOIN faculty f ON f.id = o.facultyId AND f.status = 'active'
         JOIN subjects sub ON sub.id = o.subjectId
         JOIN sections sec ON sec.id = o.sectionId
         LEFT JOIN programs p ON p.id = sec.programId
         WHERE e.studentId = ? AND e.status = 'enrolled'
           AND ay.code = ? AND (sem.name = ? OR sem.code = ?)
         ORDER BY subjectCode, facultyName`,
        [student.id, period.academicYear, period.semester, period.semester],
      );
      res.json({
        period,
        formUrl: configuration.formUrl,
        assignments,
        completionTrackingAvailable: false,
      });
    }),
  );

  app.get(
    "/api/evaluations/reports",
    requireRole("admin", "registrar"),
    asyncRoute(async (req, res) => {
      const configuration = googleConfiguration();
      const report = makeReport(await readSummaryRows(configuration), req.query);
      res.json({
        ...report,
        formUrl: configuration.formUrl,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${configuration.spreadsheetId}/edit`,
      });
    }),
  );

  app.get(
    "/api/evaluations/my-results",
    requireRole("faculty"),
    asyncRoute(async (req, res) => {
      const faculty = await dbGet(
        db,
        "SELECT firstName, lastName FROM faculty WHERE userId = ?",
        [req.userContext.userId],
      );
      if (!faculty) throw new EvaluationError(403, "A linked faculty record is required.");
      const facultyName = `${faculty.firstName} ${faculty.lastName}`.trim();
      const duplicates = await dbGet(
        db,
        "SELECT COUNT(*) AS count FROM faculty WHERE lower(firstName || ' ' || lastName) = lower(?)",
        [facultyName],
      );
      if (Number(duplicates?.count || 0) !== 1) {
        throw new EvaluationError(403, "Faculty results are unavailable because the faculty name is not unique.");
      }
      const groups = await readSummaryRows(googleConfiguration());
      const report = makeReport(groups, { ...req.query, faculty: facultyName });
      res.json({ groups: report.groups });
    }),
  );
}
