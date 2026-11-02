import crypto from "crypto";
import { get as dbGet, all as dbAll, run as dbRun, withTransaction } from "./db.js";

const MIN_REPORTING_RESPONSES = 5;

class EvaluationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isOpen(period) {
  const today = new Date().toISOString().slice(0, 10);
  return (period.status || period.periodStatus) === "active" &&
    period.startDate <= today &&
    period.endDate >= today;
}

function interpretation(value) {
  if (value >= 4.5) return "Excellent";
  if (value >= 3.5) return "Very Satisfactory";
  if (value >= 2.5) return "Satisfactory";
  if (value >= 1.5) return "Fair";
  return "Poor";
}

function asyncRoute(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      if (error instanceof EvaluationError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      if (String(error?.code || "").startsWith("SQLITE_CONSTRAINT")) {
        res.status(409).json({ error: "This evaluation has already been submitted." });
        return;
      }
      console.error("[faculty-evaluations] request failed:", error);
      res.status(500).json({ error: "Unable to process the faculty evaluation request." });
    });
  };
}

async function ensureConfigurationEditable(db) {
  const activePeriod = await dbGet(
    db,
    "SELECT id FROM faculty_evaluations WHERE status = 'active' LIMIT 1",
  );
  if (activePeriod) {
    throw new EvaluationError(409, "Close active evaluation periods before changing their questionnaire.");
  }
}

function reportFilters(query, alias = "ev") {
  const clauses = [`${alias}.status IN ('active', 'closed')`];
  const params = [];
  for (const [queryKey, column] of [
    ["evaluationId", `${alias}.id`],
    ["academicYearId", `${alias}.academicYearId`],
    ["semesterId", `${alias}.semesterId`],
  ]) {
    const value = String(query[queryKey] || "").trim();
    if (value) {
      clauses.push(`${column} = ?`);
      params.push(value);
    }
  }
  const facultyId = String(query.facultyId || "").trim();
  if (facultyId) {
    clauses.push("o.facultyId = ?");
    params.push(facultyId);
  }
  const programId = String(query.programId || "").trim();
  if (programId) {
    clauses.push("sec.programId = ?");
    params.push(programId);
  }
  const subjectOfferingId = String(query.subjectOfferingId || "").trim();
  if (subjectOfferingId) {
    clauses.push("o.id = ?");
    params.push(subjectOfferingId);
  }
  return { sql: clauses.join(" AND "), params };
}

async function findStudent(db, identity) {
  return dbGet(
    db,
    "SELECT id FROM students WHERE userId = ? OR studentId = ? LIMIT 1",
    [identity.userId, identity.studentId],
  );
}

async function loadEvaluationReport(db, query) {
  const filters = reportFilters(query);

  const periods = await dbAll(
    db,
    `SELECT ev.id, ev.title, ev.academicYearId, ev.semesterId, ev.startDate, ev.endDate, ev.status,
            ay.code AS academicYear, sem.name AS semester
     FROM faculty_evaluations ev
     JOIN academicYears ay ON ay.id = ev.academicYearId
     JOIN semesters sem ON sem.id = ev.semesterId
     WHERE ev.status IN ('active', 'closed')
       ${query.evaluationId ? "AND ev.id = ?" : ""}
       ${query.academicYearId ? "AND ev.academicYearId = ?" : ""}
       ${query.semesterId ? "AND ev.semesterId = ?" : ""}
     ORDER BY ay.code DESC, sem.sequence DESC, ev.createdAt DESC`,
    [
      ...(query.evaluationId ? [String(query.evaluationId)] : []),
      ...(query.academicYearId ? [String(query.academicYearId)] : []),
      ...(query.semesterId ? [String(query.semesterId)] : []),
    ],
  );

  const groups = await dbAll(
    db,
    `SELECT ev.id AS evaluationId, ev.title AS evaluationTitle, ay.code AS academicYear,
            sem.name AS semester, f.id AS facultyId,
            f.firstName || ' ' || f.lastName AS facultyName,
            o.id AS subjectOfferingId, sub.code AS subjectCode, sub.title AS subjectTitle,
            p.name AS programName, COUNT(DISTINCT r.id) AS responseCount,
            AVG(a.rating) AS overallAverage
     FROM faculty_evaluations ev
     JOIN subjectOfferings o ON o.academicYearId = ev.academicYearId AND o.semesterId = ev.semesterId
     JOIN faculty f ON f.id = o.facultyId
     JOIN subjects sub ON sub.id = o.subjectId
     JOIN sections sec ON sec.id = o.sectionId
     LEFT JOIN programs p ON p.id = sec.programId
     JOIN academicYears ay ON ay.id = ev.academicYearId
     JOIN semesters sem ON sem.id = ev.semesterId
     LEFT JOIN evaluation_responses r
       ON r.evaluationId = ev.id AND r.subjectOfferingId = o.id AND r.facultyId = f.id
     LEFT JOIN evaluation_answers a
       ON a.responseId = r.id AND a.rating BETWEEN 1 AND 5
     WHERE ${filters.sql}
     GROUP BY ev.id, o.id, f.id, sub.code, sub.title, p.name, ay.code, sem.name
     HAVING COUNT(DISTINCT r.id) >= ?
     ORDER BY ay.code DESC, sem.sequence DESC, facultyName, subjectCode`,
    [...filters.params, MIN_REPORTING_RESPONSES],
  );

  const categoryRows = await dbAll(
    db,
    `SELECT r.evaluationId, r.facultyId, r.subjectOfferingId, pq.criteriaId,
            pq.categoryName AS category, AVG(a.rating) AS average
     FROM evaluation_responses r
     JOIN evaluation_answers a ON a.responseId = r.id AND a.rating BETWEEN 1 AND 5
     JOIN evaluation_period_questions pq
       ON pq.evaluationId = r.evaluationId AND pq.questionId = a.questionId
     JOIN faculty f ON f.id = r.facultyId
     JOIN subjectOfferings o ON o.id = r.subjectOfferingId
     JOIN sections sec ON sec.id = o.sectionId
     JOIN faculty_evaluations ev ON ev.id = r.evaluationId
     WHERE ${filters.sql}
     GROUP BY r.evaluationId, r.facultyId, r.subjectOfferingId, pq.criteriaId, pq.categoryName
     ORDER BY pq.categoryName`,
    filters.params,
  );

  const questionRows = await dbAll(
    db,
    `SELECT r.evaluationId, r.facultyId, r.subjectOfferingId, pq.questionId,
            pq.questionText, AVG(a.rating) AS average
     FROM evaluation_responses r
     JOIN evaluation_answers a ON a.responseId = r.id AND a.rating BETWEEN 1 AND 5
     JOIN evaluation_period_questions pq
       ON pq.evaluationId = r.evaluationId AND pq.questionId = a.questionId
     JOIN faculty f ON f.id = r.facultyId
     JOIN subjectOfferings o ON o.id = r.subjectOfferingId
     JOIN sections sec ON sec.id = o.sectionId
     JOIN faculty_evaluations ev ON ev.id = r.evaluationId
     WHERE ${filters.sql}
     GROUP BY r.evaluationId, r.facultyId, r.subjectOfferingId, pq.questionId, pq.questionText
     ORDER BY pq.questionOrder, pq.questionText`,
    filters.params,
  );

  const keyOf = (row) => `${row.evaluationId}:${row.facultyId}:${row.subjectOfferingId}`;
  const categoriesByGroup = new Map();
  for (const row of categoryRows) {
    const key = keyOf(row);
    const categories = categoriesByGroup.get(key) || [];
    categories.push({
      criteriaId: row.criteriaId,
      category: row.category,
      average: Number(Number(row.average).toFixed(2)),
      interpretation: interpretation(Number(row.average)),
    });
    categoriesByGroup.set(key, categories);
  }
  const questionsByGroup = new Map();
  for (const row of questionRows) {
    const key = keyOf(row);
    const questions = questionsByGroup.get(key) || [];
    questions.push({
      questionId: row.questionId,
      questionText: row.questionText,
      average: Number(Number(row.average).toFixed(2)),
      interpretation: interpretation(Number(row.average)),
    });
    questionsByGroup.set(key, questions);
  }

  const visibleGroups = groups.map((group) => ({
    ...group,
    responseCount: Number(group.responseCount),
    overallAverage: Number(Number(group.overallAverage).toFixed(2)),
    interpretation: interpretation(Number(group.overallAverage)),
    categories: categoriesByGroup.get(keyOf(group)) || [],
    questions: questionsByGroup.get(keyOf(group)) || [],
  }));
  const completionRows = await dbAll(
    db,
    `SELECT ev.id AS evaluationId,
            COUNT(DISTINCT CASE WHEN e.status = 'enrolled' THEN ev.id || ':' || e.studentId || ':' || o.id END) AS eligibleCount,
            COUNT(DISTINCT CASE WHEN ep.id IS NOT NULL THEN ep.evaluationId || ':' || ep.studentId || ':' || ep.subjectOfferingId END) AS completedCount
     FROM faculty_evaluations ev
     JOIN subjectOfferings o ON o.academicYearId = ev.academicYearId AND o.semesterId = ev.semesterId
     JOIN sections sec ON sec.id = o.sectionId
     LEFT JOIN enrollments e ON e.subjectOfferingId = o.id AND e.status = 'enrolled'
     LEFT JOIN evaluation_participation ep
       ON ep.evaluationId = ev.id AND ep.subjectOfferingId = o.id AND ep.studentId = e.studentId
     WHERE ${filters.sql} AND o.facultyId IS NOT NULL
     GROUP BY ev.id`,
    filters.params,
  );
  const completion = completionRows.map((row) => {
    const eligibleCount = Number(row.eligibleCount);
    const completedCount = Number(row.completedCount);
    const suppressed =
      eligibleCount < MIN_REPORTING_RESPONSES || completedCount < MIN_REPORTING_RESPONSES;
    return {
      evaluationId: row.evaluationId,
      eligibleCount: suppressed ? null : eligibleCount,
      completedCount: suppressed ? null : completedCount,
      percentage: suppressed
        ? null
        : Number(((completedCount / eligibleCount) * 100).toFixed(1)),
      suppressed,
    };
  });

  return { periods, completion, groups: visibleGroups };
}

export function registerFacultyEvaluationRoutes(app, db, { requireRole }) {
  app.get(
    "/api/evaluations/periods",
    requireRole("admin", "registrar", "student"),
    asyncRoute(async (req, res) => {
      const periods = await dbAll(
        db,
        `SELECT ev.id, ev.title, ev.academicYearId, ev.semesterId, ev.startDate, ev.endDate,
                ev.status, ay.code AS academicYear, sem.name AS semester
         FROM faculty_evaluations ev
         JOIN academicYears ay ON ay.id = ev.academicYearId
         JOIN semesters sem ON sem.id = ev.semesterId
         ${req.userContext.role === "student" ? "WHERE ev.status = 'active'" : ""}
         ORDER BY ay.code DESC, sem.sequence DESC, ev.createdAt DESC`,
      );
      res.json(
        req.userContext.role === "student"
          ? periods.filter(isOpen)
          : periods,
      );
    }),
  );

  app.post(
    "/api/evaluations/periods",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      const { title, academicYearId, semesterId, startDate, endDate } = req.body || {};
      if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof academicYearId !== "string" ||
        typeof semesterId !== "string" ||
        !isIsoDate(startDate) ||
        !isIsoDate(endDate) ||
        startDate > endDate
      ) {
        return res.status(400).json({ error: "Provide a title, matching academic year and semester, and valid dates." });
      }
      const semester = await dbGet(
        db,
        "SELECT id FROM semesters WHERE id = ? AND academicYearId = ?",
        [semesterId, academicYearId],
      );
      if (!semester) return res.status(400).json({ error: "Semester does not belong to the selected academic year." });

      const period = {
        id: crypto.randomUUID(),
        title: title.trim(),
        academicYearId,
        semesterId,
        startDate,
        endDate,
        status: "draft",
        createdBy: req.userContext.userId,
        createdAt: Date.now(),
      };
      await dbRun(
        db,
        `INSERT INTO faculty_evaluations
         (id, title, academicYearId, semesterId, startDate, endDate, status, createdBy, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          period.id,
          period.title,
          period.academicYearId,
          period.semesterId,
          period.startDate,
          period.endDate,
          period.status,
          period.createdBy,
          period.createdAt,
        ],
      );
      res.status(201).json(period);
    }),
  );

  app.put(
    "/api/evaluations/periods/:id",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      const period = await dbGet(db, "SELECT * FROM faculty_evaluations WHERE id = ?", [req.params.id]);
      if (!period) return res.status(404).json({ error: "Evaluation period not found." });
      if (period.status === "active" && req.body?.status !== "closed") {
        return res.status(409).json({ error: "Close an active evaluation period before editing its details." });
      }
      const title = req.body?.title === undefined ? period.title : String(req.body.title).trim();
      const academicYearId = req.body?.academicYearId ?? period.academicYearId;
      const semesterId = req.body?.semesterId ?? period.semesterId;
      const startDate = req.body?.startDate ?? period.startDate;
      const endDate = req.body?.endDate ?? period.endDate;
      const status = req.body?.status ?? period.status;
      if (
        !title ||
        !isIsoDate(startDate) ||
        !isIsoDate(endDate) ||
        startDate > endDate ||
        !["draft", "active", "closed"].includes(status)
      ) {
        return res.status(400).json({ error: "Evaluation period details are invalid." });
      }
      const semester = await dbGet(
        db,
        "SELECT id FROM semesters WHERE id = ? AND academicYearId = ?",
        [semesterId, academicYearId],
      );
      if (!semester) return res.status(400).json({ error: "Semester does not belong to the selected academic year." });
      if (status === "active") {
        const snapshotCount = await dbGet(
          db,
          "SELECT COUNT(*) AS count FROM evaluation_period_questions WHERE evaluationId = ?",
          [req.params.id],
        );
        const activeQuestion = Number(snapshotCount?.count || 0) > 0
          ? true
          : await dbGet(
          db,
          `SELECT q.id
           FROM evaluation_questions q
           JOIN evaluation_criteria c ON c.id = q.criteriaId
           WHERE q.isActive = 1 AND c.isActive = 1
           LIMIT 1`,
        );
        if (!activeQuestion) return res.status(400).json({ error: "At least one active evaluation question is required." });
      }
      if (status === "active") {
        await withTransaction(db, async () => {
          await dbRun(
            db,
            `INSERT OR IGNORE INTO evaluation_period_questions
             (evaluationId, questionId, criteriaId, categoryName, categoryOrder, questionText, questionOrder, isRequired)
             SELECT ?, q.id, c.id, c.name, c.displayOrder, q.questionText, q.displayOrder, q.isRequired
             FROM evaluation_questions q
             JOIN evaluation_criteria c ON c.id = q.criteriaId
             WHERE q.isActive = 1 AND c.isActive = 1`,
            [req.params.id],
          );
          await dbRun(
            db,
            `UPDATE faculty_evaluations
             SET title = ?, academicYearId = ?, semesterId = ?, startDate = ?, endDate = ?, status = ?
             WHERE id = ?`,
            [title, academicYearId, semesterId, startDate, endDate, status, req.params.id],
          );
        });
      } else {
        await dbRun(
          db,
          `UPDATE faculty_evaluations
           SET title = ?, academicYearId = ?, semesterId = ?, startDate = ?, endDate = ?, status = ?
           WHERE id = ?`,
          [title, academicYearId, semesterId, startDate, endDate, status, req.params.id],
        );
      }
      res.json({ ...period, title, academicYearId, semesterId, startDate, endDate, status });
    }),
  );

  app.get(
    "/api/evaluations/criteria",
    requireRole("admin"),
    asyncRoute(async (_req, res) => {
      res.json(
        await dbAll(db, "SELECT id, name, description, displayOrder, isActive FROM evaluation_criteria ORDER BY displayOrder, name"),
      );
    }),
  );

  app.post(
    "/api/evaluations/criteria",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      await ensureConfigurationEditable(db);
      const name = String(req.body?.name || "").trim();
      if (!name) return res.status(400).json({ error: "Category name is required." });
      const row = {
        id: crypto.randomUUID(),
        name,
        description: String(req.body?.description || "").trim() || null,
        displayOrder: Number.isInteger(req.body?.displayOrder) ? req.body.displayOrder : 0,
        isActive: 1,
      };
      await dbRun(
        db,
        "INSERT INTO evaluation_criteria (id, name, description, displayOrder, isActive) VALUES (?, ?, ?, ?, 1)",
        [row.id, row.name, row.description, row.displayOrder],
      );
      res.status(201).json(row);
    }),
  );

  app.put(
    "/api/evaluations/criteria/:id",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      await ensureConfigurationEditable(db);
      const category = await dbGet(db, "SELECT * FROM evaluation_criteria WHERE id = ?", [req.params.id]);
      if (!category) return res.status(404).json({ error: "Evaluation category not found." });
      const name = req.body?.name === undefined ? category.name : String(req.body.name).trim();
      const description =
        req.body?.description === undefined ? category.description : String(req.body.description).trim() || null;
      const displayOrder =
        req.body?.displayOrder === undefined ? category.displayOrder : Number(req.body.displayOrder);
      const isActive =
        req.body?.isActive === undefined ? category.isActive : req.body.isActive ? 1 : 0;
      if (!name || !Number.isInteger(displayOrder)) {
        return res.status(400).json({ error: "Category details are invalid." });
      }
      await dbRun(
        db,
        "UPDATE evaluation_criteria SET name = ?, description = ?, displayOrder = ?, isActive = ? WHERE id = ?",
        [name, description, displayOrder, isActive, req.params.id],
      );
      res.json({ ...category, name, description, displayOrder, isActive });
    }),
  );

  app.get(
    "/api/evaluations/questions",
    requireRole("admin"),
    asyncRoute(async (_req, res) => {
      res.json(
        await dbAll(
          db,
          `SELECT q.id, q.criteriaId, c.name AS category, q.questionText, q.isRequired,
                  q.displayOrder, q.isActive
           FROM evaluation_questions q
           JOIN evaluation_criteria c ON c.id = q.criteriaId
           ORDER BY c.displayOrder, q.displayOrder, q.questionText`,
        ),
      );
    }),
  );

  app.post(
    "/api/evaluations/questions",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      await ensureConfigurationEditable(db);
      const { criteriaId } = req.body || {};
      const questionText = String(req.body?.questionText || "").trim();
      if (!criteriaId || !questionText) {
        return res.status(400).json({ error: "A category and question text are required." });
      }
      const criteria = await dbGet(
        db,
        "SELECT id FROM evaluation_criteria WHERE id = ? AND isActive = 1",
        [criteriaId],
      );
      if (!criteria) return res.status(400).json({ error: "Select an active evaluation category." });
      const displayOrder = Number.isInteger(req.body?.displayOrder) ? req.body.displayOrder : 0;
      const question = {
        id: crypto.randomUUID(),
        criteriaId,
        questionText,
        isRequired: req.body?.isRequired === false ? 0 : 1,
        displayOrder,
        isActive: 1,
      };
      await dbRun(
        db,
        `INSERT INTO evaluation_questions
         (id, criteriaId, questionText, isRequired, displayOrder, isActive)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [question.id, criteriaId, questionText, question.isRequired, displayOrder],
      );
      res.status(201).json(question);
    }),
  );

  app.put(
    "/api/evaluations/questions/:id",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      await ensureConfigurationEditable(db);
      const question = await dbGet(db, "SELECT * FROM evaluation_questions WHERE id = ?", [req.params.id]);
      if (!question) return res.status(404).json({ error: "Evaluation question not found." });
      const criteriaId = req.body?.criteriaId ?? question.criteriaId;
      const questionText =
        req.body?.questionText === undefined
          ? question.questionText
          : String(req.body.questionText).trim();
      const isRequired =
        req.body?.isRequired === undefined ? question.isRequired : req.body.isRequired ? 1 : 0;
      const displayOrder =
        req.body?.displayOrder === undefined ? question.displayOrder : Number(req.body.displayOrder);
      const isActive =
        req.body?.isActive === undefined ? question.isActive : req.body.isActive ? 1 : 0;
      const criteria = await dbGet(db, "SELECT id FROM evaluation_criteria WHERE id = ?", [criteriaId]);
      if (!criteria || !questionText || !Number.isInteger(displayOrder)) {
        return res.status(400).json({ error: "Evaluation question details are invalid." });
      }
      await dbRun(
        db,
        `UPDATE evaluation_questions
         SET criteriaId = ?, questionText = ?, isRequired = ?, displayOrder = ?, isActive = ?
         WHERE id = ?`,
        [criteriaId, questionText, isRequired, displayOrder, isActive, req.params.id],
      );
      res.json({ ...question, criteriaId, questionText, isRequired, displayOrder, isActive });
    }),
  );

  app.get(
    "/api/evaluations/periods/:id/questions",
    requireRole("admin", "student"),
    asyncRoute(async (req, res) => {
      const period = await dbGet(db, "SELECT * FROM faculty_evaluations WHERE id = ?", [req.params.id]);
      if (!period) return res.status(404).json({ error: "Evaluation period not found." });
      if (req.userContext.role === "student" && !isOpen(period)) {
        return res.status(403).json({ error: "This evaluation period is not open." });
      }
      const questionCount = await dbGet(
        db,
        "SELECT COUNT(*) AS count FROM evaluation_period_questions WHERE evaluationId = ?",
        [req.params.id],
      );
      const rows = Number(questionCount?.count || 0) > 0
        ? await dbAll(
          db,
          `SELECT pq.criteriaId, pq.categoryName AS category, pq.categoryOrder,
                  pq.questionId, pq.questionText, pq.isRequired, pq.questionOrder AS displayOrder
           FROM evaluation_period_questions pq
           WHERE pq.evaluationId = ?
           ORDER BY pq.categoryOrder, pq.questionOrder, pq.questionText`,
          [req.params.id],
        )
        : await dbAll(
          db,
          `SELECT c.id AS criteriaId, c.name AS category, c.displayOrder AS categoryOrder,
                  q.id AS questionId, q.questionText, q.isRequired, q.displayOrder
           FROM evaluation_questions q
           JOIN evaluation_criteria c ON c.id = q.criteriaId
           WHERE q.isActive = 1 AND c.isActive = 1
           ORDER BY c.displayOrder, q.displayOrder, q.questionText`,
        );
      res.json(rows);
    }),
  );

  app.get(
    "/api/evaluations/eligible",
    requireRole("student"),
    asyncRoute(async (req, res) => {
      const student = await findStudent(db, req.userContext);
      if (!student) return res.status(403).json({ error: "A linked student record is required." });
      const periods = await dbAll(
        db,
        `SELECT ev.id, ev.title, ev.academicYearId, ev.semesterId, ev.startDate, ev.endDate,
                ev.status AS periodStatus, ay.code AS academicYear, sem.name AS semester
         FROM faculty_evaluations ev
         JOIN academicYears ay ON ay.id = ev.academicYearId
         JOIN semesters sem ON sem.id = ev.semesterId
         WHERE ev.status IN ('active', 'closed')
         ORDER BY ev.createdAt DESC`,
      );
      if (!periods.length) return res.json([]);
      const placeholders = periods.map(() => "?").join(", ");
      const rows = await dbAll(
        db,
        `SELECT ev.id AS evaluationId, ev.title AS evaluationTitle, ev.startDate, ev.endDate,
                ev.academicYearId, ev.semesterId, ev.status AS periodStatus,
                ay.code AS academicYear, sem.name AS semester,
                o.id AS subjectOfferingId, sub.code AS subjectCode, sub.title AS subjectTitle,
                f.id AS facultyId, f.firstName || ' ' || f.lastName AS facultyName,
                p.name AS programName,
                CASE WHEN ep.id IS NULL THEN 0 ELSE 1 END AS completed
         FROM faculty_evaluations ev
         JOIN subjectOfferings o ON o.academicYearId = ev.academicYearId AND o.semesterId = ev.semesterId
         JOIN enrollments e ON e.subjectOfferingId = o.id AND e.studentId = ?
           AND e.status IN ('enrolled', 'completed')
         JOIN faculty f ON f.id = o.facultyId
         JOIN subjects sub ON sub.id = o.subjectId
         JOIN academicYears ay ON ay.id = ev.academicYearId
         JOIN semesters sem ON sem.id = ev.semesterId
         JOIN sections sec ON sec.id = o.sectionId
         LEFT JOIN programs p ON p.id = sec.programId
         LEFT JOIN evaluation_participation ep
           ON ep.evaluationId = ev.id AND ep.studentId = e.studentId AND ep.subjectOfferingId = o.id
         WHERE ev.id IN (${placeholders})
         ORDER BY ev.createdAt DESC, subjectCode`,
        [student.id, ...periods.map((period) => period.id)],
      );
      const openPeriodIds = new Set(periods.filter(isOpen).map((period) => period.id));
      res.json(rows.map((row) => ({
        ...row,
        canSubmit: openPeriodIds.has(row.evaluationId) && !row.completed,
      })));
    }),
  );

  app.post(
    "/api/evaluations/submit",
    requireRole("student"),
    asyncRoute(async (req, res) => {
      const { evaluationId, subjectOfferingId, answers, feedback } = req.body || {};
      if (
        typeof evaluationId !== "string" ||
        typeof subjectOfferingId !== "string" ||
        !Array.isArray(answers) ||
        answers.length > 50 ||
        (feedback !== undefined && feedback !== null && typeof feedback !== "string") ||
        (typeof feedback === "string" && feedback.length > 2000)
      ) {
        return res.status(400).json({ error: "Evaluation submission details are invalid." });
      }
      const student = await findStudent(db, req.userContext);
      if (!student) return res.status(403).json({ error: "A linked student record is required." });
      const period = await dbGet(db, "SELECT * FROM faculty_evaluations WHERE id = ?", [evaluationId]);
      if (!period || !isOpen(period)) {
        return res.status(409).json({ error: "This evaluation period is closed or unavailable." });
      }
      const offering = await dbGet(
        db,
        `SELECT o.id, o.facultyId
         FROM subjectOfferings o
         JOIN enrollments e ON e.subjectOfferingId = o.id
         WHERE o.id = ? AND e.studentId = ? AND e.status = 'enrolled'
           AND o.academicYearId = ? AND o.semesterId = ? AND o.facultyId IS NOT NULL`,
        [subjectOfferingId, student.id, period.academicYearId, period.semesterId],
      );
      if (!offering) return res.status(403).json({ error: "You are not enrolled in this faculty assignment." });
      const questions = await dbAll(
        db,
        `SELECT q.id, pq.isRequired
         FROM evaluation_period_questions pq
         JOIN evaluation_questions q ON q.id = pq.questionId
         WHERE pq.evaluationId = ?`,
        [evaluationId],
      );
      const questionMap = new Map(questions.map((question) => [question.id, question]));
      const answerMap = new Map();
      for (const answer of answers) {
        if (
          !answer ||
          typeof answer.questionId !== "string" ||
          !Number.isInteger(answer.rating) ||
          answer.rating < 1 ||
          answer.rating > 5 ||
          answerMap.has(answer.questionId) ||
          !questionMap.has(answer.questionId)
        ) {
          return res.status(400).json({ error: "Each answer must have a unique active question and a rating from 1 to 5." });
        }
        answerMap.set(answer.questionId, answer.rating);
      }
      if (questions.some((question) => question.isRequired && !answerMap.has(question.id))) {
        return res.status(400).json({ error: "Answer every required evaluation question." });
      }
      if (!answerMap.size) return res.status(400).json({ error: "At least one evaluation answer is required." });

      try {
        await withTransaction(db, async () => {
          const existing = await dbGet(
            db,
            `SELECT id FROM evaluation_participation
             WHERE evaluationId = ? AND studentId = ? AND subjectOfferingId = ?`,
            [evaluationId, student.id, subjectOfferingId],
          );
          if (existing) throw new EvaluationError(409, "This faculty-subject evaluation was already submitted.");
          const responseId = crypto.randomUUID();
          await dbRun(
            db,
            `INSERT INTO evaluation_participation
             (id, evaluationId, studentId, subjectOfferingId, completedAt)
             VALUES (?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), evaluationId, student.id, subjectOfferingId, Date.now()],
          );
          await dbRun(
            db,
            `INSERT INTO evaluation_responses (id, evaluationId, facultyId, subjectOfferingId, feedback)
             VALUES (?, ?, ?, ?, ?)`,
            [responseId, evaluationId, offering.facultyId, subjectOfferingId, String(feedback || "").trim() || null],
          );
          for (const [questionId, rating] of answerMap) {
            await dbRun(
              db,
              "INSERT INTO evaluation_answers (id, responseId, questionId, rating, comment) VALUES (?, ?, ?, ?, NULL)",
              [crypto.randomUUID(), responseId, questionId, rating],
            );
          }
        });
      } catch (error) {
        if (error instanceof EvaluationError) throw error;
        if (String(error?.code || "").startsWith("SQLITE_CONSTRAINT")) {
          throw new EvaluationError(409, "This faculty-subject evaluation was already submitted.");
        }
        throw error;
      }
      res.status(201).json({ success: true, completed: true });
    }),
  );

  app.get(
    "/api/evaluations/reports",
    requireRole("admin", "registrar"),
    asyncRoute(async (req, res) => {
      res.json(await loadEvaluationReport(db, req.query));
    }),
  );

  app.get(
    "/api/evaluations/my-results",
    requireRole("faculty"),
    asyncRoute(async (req, res) => {
      const faculty = await dbGet(db, "SELECT id FROM faculty WHERE userId = ?", [req.userContext.userId]);
      if (!faculty) return res.status(403).json({ error: "A linked faculty record is required." });
      res.json(await loadEvaluationReport(db, { ...req.query, facultyId: faculty.id }));
    }),
  );
}
