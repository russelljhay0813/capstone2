import crypto from "crypto";
import { get as dbGet, all as dbAll, run as dbRun, withTransaction } from "./db.js";
import { FACULTY_EVALUATION_QUESTIONNAIRE } from "./faculty-evaluation-questionnaire.js";

const MIN_REPORTING_RESPONSES = 5;
const canonicalQuestionPairs = FACULTY_EVALUATION_QUESTIONNAIRE.flatMap((category) =>
  category.questions.map((questionText) => [category.name, questionText]),
);
const canonicalQuestionCondition = canonicalQuestionPairs
  .map(() => "(c.name = ? AND q.questionText = ?)")
  .join(" OR ");
const canonicalQuestionParams = canonicalQuestionPairs.flat();
const DEFAULT_RATING_SCALE = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Satisfactory" },
  { value: 4, label: "Very Satisfactory" },
  { value: 5, label: "Excellent" },
];

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

function validateRatingScale(value) {
  return Array.isArray(value) &&
    value.length === 5 &&
    value.every((item, index) =>
      item &&
      item.value === index + 1 &&
      typeof item.label === "string" &&
      item.label.trim().length > 0 &&
      item.label.trim().length <= 60,
    );
}

async function saveDraftQuestionnaire(db, evaluationId, categories, ratingScale) {
  if (!Array.isArray(categories) || categories.length > 30 || !validateRatingScale(ratingScale)) {
    throw new EvaluationError(400, "Questionnaire categories or rating scale are invalid.");
  }
  const normalized = [];
  for (const [categoryIndex, category] of categories.entries()) {
    const name = typeof category?.name === "string" ? category.name.trim() : "";
    if (!name || name.length > 120 || !Array.isArray(category.questions) || category.questions.length > 100) {
      throw new EvaluationError(400, "Each questionnaire category needs a valid name and question list.");
    }
    const description =
      typeof category.description === "string" ? category.description.trim().slice(0, 500) : "";
    const questions = [];
    for (const [questionIndex, question] of category.questions.entries()) {
      const questionText =
        typeof question?.questionText === "string" ? question.questionText.trim() : "";
      if (!questionText || questionText.length > 1000) {
        throw new EvaluationError(400, "Each evaluation question needs valid question text.");
      }
      if (question.questionType !== undefined && question.questionType !== "rating") {
        throw new EvaluationError(400, "Only rating questions are currently supported.");
      }
      questions.push({
        questionText,
        isRequired: question.isRequired === false ? 0 : 1,
        displayOrder: questionIndex + 1,
      });
    }
    normalized.push({ name, description, displayOrder: categoryIndex + 1, questions });
  }

  await withTransaction(db, async () => {
    await dbRun(db, "DELETE FROM evaluation_period_questions WHERE evaluationId = ?", [evaluationId]);
    await dbRun(db, "DELETE FROM evaluation_period_categories WHERE evaluationId = ?", [evaluationId]);
    for (const category of normalized) {
      let criteria = await dbGet(db, "SELECT id FROM evaluation_criteria WHERE name = ?", [category.name]);
      if (!criteria) {
        criteria = { id: crypto.randomUUID() };
        await dbRun(
          db,
          `INSERT INTO evaluation_criteria (id, name, description, displayOrder, isActive)
           VALUES (?, ?, ?, ?, 1)`,
          [criteria.id, category.name, category.description || null, category.displayOrder],
        );
      }
      await dbRun(
        db,
        `INSERT INTO evaluation_period_categories
         (evaluationId, criteriaId, categoryName, description, categoryOrder)
         VALUES (?, ?, ?, ?, ?)`,
        [
          evaluationId,
          criteria.id,
          category.name,
          category.description || null,
          category.displayOrder,
        ],
      );
      for (const question of category.questions) {
        let savedQuestion = await dbGet(
          db,
          "SELECT id FROM evaluation_questions WHERE criteriaId = ? AND questionText = ?",
          [criteria.id, question.questionText],
        );
        if (!savedQuestion) {
          savedQuestion = { id: crypto.randomUUID() };
          await dbRun(
            db,
            `INSERT INTO evaluation_questions
             (id, criteriaId, questionText, isRequired, displayOrder, isActive)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [savedQuestion.id, criteria.id, question.questionText, question.isRequired, question.displayOrder],
          );
        }
        await dbRun(
          db,
          `INSERT INTO evaluation_period_questions
           (evaluationId, questionId, criteriaId, categoryName, categoryOrder, questionText,
            questionOrder, isRequired, questionType)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rating')`,
          [
            evaluationId,
            savedQuestion.id,
            criteria.id,
            category.name,
            category.displayOrder,
            question.questionText,
            question.displayOrder,
            question.isRequired,
          ],
        );
      }
    }
    await dbRun(
      db,
      `UPDATE faculty_evaluations
       SET ratingScale = ?, questionnaireDraftSaved = 1
       WHERE id = ?`,
      [
         JSON.stringify(ratingScale),
         evaluationId,
      ],
    );
  });
}

async function publishQuestionnaire(db, period) {
  let questions = await dbAll(
    db,
    `SELECT criteriaId, categoryName AS category, categoryOrder, questionId, questionText,
            isRequired, questionType, questionOrder AS displayOrder
     FROM evaluation_period_questions WHERE evaluationId = ?
     ORDER BY categoryOrder, questionOrder`,
    [period.id],
  );
  if (!questions.length && !period.questionnaireDraftSaved) {
    await dbRun(
      db,
      `INSERT OR IGNORE INTO evaluation_period_questions
       (evaluationId, questionId, criteriaId, categoryName, categoryOrder, questionText,
        questionOrder, isRequired, questionType)
       SELECT ?, q.id, c.id, c.name, c.displayOrder, q.questionText, q.displayOrder, 1, 'rating'
       FROM evaluation_questions q
       JOIN evaluation_criteria c ON c.id = q.criteriaId
       WHERE ${canonicalQuestionCondition}`,
      [period.id, ...canonicalQuestionParams],
    );
    questions = await dbAll(
      db,
      `SELECT criteriaId, categoryName AS category, categoryOrder, questionId, questionText,
              isRequired, questionType, questionOrder AS displayOrder
       FROM evaluation_period_questions WHERE evaluationId = ?
       ORDER BY categoryOrder, questionOrder`,
      [period.id],
    );
  }
  if (!questions.length || !questions.some((question) => question.isRequired)) {
    throw new EvaluationError(409, "Add at least one required question before publishing.");
  }
  if (questions.some((question) => question.questionType !== "rating")) {
    throw new EvaluationError(409, "The questionnaire contains an unsupported question type.");
  }
  let ratingScale;
  try {
    ratingScale = JSON.parse(period.ratingScale || "null");
  } catch {
    ratingScale = null;
  }
  if (!validateRatingScale(ratingScale)) {
    throw new EvaluationError(409, "Configure all five rating labels before publishing.");
  }
  const categoryRows = await dbAll(
    db,
    `SELECT criteriaId, categoryName AS name, description, categoryOrder AS displayOrder
     FROM evaluation_period_categories WHERE evaluationId = ?
     ORDER BY categoryOrder`,
    [period.id],
  );
  const categoriesById = new Map(
    categoryRows.map((category) => [category.criteriaId, { ...category, questions: [] }]),
  );
  for (const question of questions) {
    let category = categoriesById.get(question.criteriaId);
    if (!category) {
      category = {
        criteriaId: question.criteriaId,
        name: question.category,
        description: null,
        displayOrder: question.categoryOrder,
        questions: [],
      };
      categoriesById.set(question.criteriaId, category);
    }
    category.questions.push({
      questionId: question.questionId,
      questionText: question.questionText,
      isRequired: Boolean(question.isRequired),
      questionType: question.questionType,
      displayOrder: question.displayOrder,
    });
  }
  const version = Number(period.questionnaireVersion || 0) + 1;
  const questionnaire = {
    version,
    ratingScale,
    categories: [...categoriesById.values()],
    questions,
  };
  await dbRun(
    db,
    `INSERT INTO evaluation_questionnaire_versions
     (id, evaluationId, version, questionnaireJson, publishedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), period.id, version, JSON.stringify(questionnaire), Date.now()],
  );
  return version;
}

async function loadPublishedQuestionnaire(db, period) {
  const version = Number(period.questionnaireVersion || 0);
  if (version < 1) {
    throw new EvaluationError(409, "This evaluation has no published questionnaire.");
  }
  const row = await dbGet(
    db,
    `SELECT questionnaireJson FROM evaluation_questionnaire_versions
     WHERE evaluationId = ? AND version = ?`,
    [period.id, version],
  );
  if (!row) {
    throw new EvaluationError(409, "The published questionnaire version is unavailable.");
  }
  let questionnaire;
  try {
    questionnaire = JSON.parse(row.questionnaireJson);
  } catch {
    throw new EvaluationError(500, "The published questionnaire snapshot is invalid.");
  }
  if (
    !questionnaire ||
    !Array.isArray(questionnaire.questions) ||
    !validateRatingScale(questionnaire.ratingScale)
  ) {
    throw new EvaluationError(500, "The published questionnaire snapshot is incomplete.");
  }
  return questionnaire;
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
    "/api/evaluations/questionnaire/default",
    requireRole("admin"),
    (_req, res) => {
      res.json({
        categories: FACULTY_EVALUATION_QUESTIONNAIRE.map((category) => ({
          name: category.name,
          description: category.description,
          questions: category.questions.map((questionText) => ({
            questionText,
            isRequired: true,
            questionType: "rating",
          })),
        })),
        ratingScale: DEFAULT_RATING_SCALE,
      });
    },
  );

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
         ${req.userContext.role === "student" ? "WHERE ev.status = 'active' AND ev.questionnaireVersion > 0" : ""}
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
        (title !== undefined && (typeof title !== "string" || !title.trim())) ||
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
        "SELECT id, name FROM semesters WHERE id = ? AND academicYearId = ?",
        [semesterId, academicYearId],
      );
      if (!semester) return res.status(400).json({ error: "Semester does not belong to the selected academic year." });

      const existingPeriod = await dbGet(
        db,
        "SELECT id FROM faculty_evaluations WHERE academicYearId = ? AND semesterId = ?",
        [academicYearId, semesterId],
      );
      if (existingPeriod) {
        return res.status(409).json({ error: "An evaluation period already exists for this academic year and semester." });
      }
      const academicYear = await dbGet(db, "SELECT code FROM academicYears WHERE id = ?", [academicYearId]);
      const titleText =
        typeof title === "string" && title.trim()
          ? title.trim()
          : `Faculty Evaluation - ${academicYear.code} - ${semester.name}`;
      const period = {
        id: crypto.randomUUID(),
        title: titleText,
        academicYearId,
        semesterId,
        startDate,
        endDate,
        status: "draft",
        createdBy: req.userContext.userId,
        createdAt: Date.now(),
      };
      try {
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
      } catch (error) {
        if (String(error?.code || "").startsWith("SQLITE_CONSTRAINT")) {
          throw new EvaluationError(409, "An evaluation period already exists for this academic year and semester.");
        }
        throw error;
      }
      res.status(201).json(period);
    }),
  );

  app.put(
    "/api/evaluations/periods/:id",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      const period = await dbGet(db, "SELECT * FROM faculty_evaluations WHERE id = ?", [req.params.id]);
      if (!period) return res.status(404).json({ error: "Evaluation period not found." });
      if (period.status === "closed") {
        return res.status(409).json({ error: "Closed evaluation periods cannot be changed." });
      }
      if (period.status === "active") {
        if (
          req.body?.status !== "closed" ||
          Object.keys(req.body || {}).some((key) => key !== "status")
        ) {
          return res.status(409).json({ error: "Close an active evaluation period before editing its details." });
        }
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
      try {
        if (status === "active") {
          await withTransaction(db, async () => {
            const questionnaireVersion = await publishQuestionnaire(db, period);
            await dbRun(
              db,
              `UPDATE faculty_evaluations
               SET title = ?, academicYearId = ?, semesterId = ?, startDate = ?, endDate = ?,
                   status = ?, questionnaireVersion = ?
               WHERE id = ?`,
              [
                title,
                academicYearId,
                semesterId,
                startDate,
                endDate,
                status,
                questionnaireVersion,
                req.params.id,
              ],
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
      } catch (error) {
        if (String(error?.code || "").startsWith("SQLITE_CONSTRAINT")) {
          throw new EvaluationError(409, "An evaluation period already exists for this academic year and semester.");
        }
        throw error;
      }
      res.json({
        ...period,
        title,
        academicYearId,
        semesterId,
        startDate,
        endDate,
        status,
        questionnaireVersion: status === "active" ? Number(period.questionnaireVersion || 0) + 1 : period.questionnaireVersion,
      });
    }),
  );

  app.get(
    "/api/evaluations/periods/:id/questionnaire",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      const period = await dbGet(
        db,
        "SELECT id, status, ratingScale, questionnaireVersion FROM faculty_evaluations WHERE id = ?",
        [req.params.id],
      );
      if (!period) return res.status(404).json({ error: "Evaluation period not found." });
      const questions = await dbAll(
        db,
        `SELECT criteriaId, categoryName AS category, categoryOrder, questionId, questionText,
                isRequired, questionType, questionOrder AS displayOrder
         FROM evaluation_period_questions WHERE evaluationId = ?
         ORDER BY categoryOrder, questionOrder`,
        [req.params.id],
      );
      const categories = await dbAll(
        db,
        `SELECT criteriaId, categoryName AS name, description, categoryOrder AS displayOrder
         FROM evaluation_period_categories WHERE evaluationId = ?
         ORDER BY categoryOrder`,
        [req.params.id],
      );
      const categoriesById = new Map(
        categories.map((category) => [category.criteriaId, { ...category, questions: [] }]),
      );
      for (const question of questions) {
        let category = categoriesById.get(question.criteriaId);
        if (!category) {
          category = {
            criteriaId: question.criteriaId,
            name: question.category,
            description: null,
            displayOrder: question.categoryOrder,
            questions: [],
          };
          categoriesById.set(question.criteriaId, category);
        }
        category.questions.push({
          questionText: question.questionText,
          isRequired: Boolean(question.isRequired),
          questionType: question.questionType,
        });
      }
      let ratingScale;
      try {
        ratingScale = JSON.parse(period.ratingScale);
      } catch {
        throw new EvaluationError(500, "The saved evaluation rating scale is invalid.");
      }
      res.json({
        status: period.status,
        version: period.questionnaireVersion,
        ratingScale,
        categories: [...categoriesById.values()],
        questions,
      });
    }),
  );

  app.put(
    "/api/evaluations/periods/:id/questionnaire",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      const period = await dbGet(
        db,
        "SELECT id, status, questionnaireVersion FROM faculty_evaluations WHERE id = ?",
        [req.params.id],
      );
      if (!period) return res.status(404).json({ error: "Evaluation period not found." });
      if (period.status !== "draft" || Number(period.questionnaireVersion || 0) > 0) {
        return res.status(409).json({ error: "Only an unpublished draft questionnaire can be edited." });
      }
      await saveDraftQuestionnaire(
        db,
        period.id,
        req.body?.categories,
        req.body?.ratingScale,
      );
      const questions = await dbAll(
        db,
        `SELECT criteriaId, categoryName AS category, categoryOrder, questionId, questionText,
                isRequired, questionType, questionOrder AS displayOrder
         FROM evaluation_period_questions WHERE evaluationId = ?
         ORDER BY categoryOrder, questionOrder`,
        [period.id],
      );
      res.json({ saved: true, questions });
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
      if (req.userContext.role === "student") {
        if (!isOpen(period) || Number(period.questionnaireVersion || 0) < 1) {
          return res.status(403).json({ error: "This evaluation period is not open." });
        }
        const student = await findStudent(db, req.userContext);
        const subjectOfferingId = String(req.query.subjectOfferingId || "").trim();
        const eligible = student && await dbGet(
          db,
          `SELECT o.id
           FROM subjectOfferings o
           JOIN enrollments e ON e.subjectOfferingId = o.id AND e.studentId = ?
             AND e.status = 'enrolled'
           WHERE o.academicYearId = ? AND o.semesterId = ? AND o.facultyId IS NOT NULL
             AND (? = '' OR o.id = ?)
             AND NOT EXISTS (
               SELECT 1 FROM evaluation_participation ep
               WHERE ep.evaluationId = ? AND ep.studentId = e.studentId
                 AND ep.subjectOfferingId = o.id
             )
           LIMIT 1`,
          [
            student?.id || "",
            period.academicYearId,
            period.semesterId,
            subjectOfferingId,
            subjectOfferingId,
            period.id,
          ],
        );
        if (!eligible) return res.status(403).json({ error: "You are not eligible to answer this evaluation." });
      }
      let rows;
      let ratingScale;
      if (Number(period.questionnaireVersion || 0) > 0) {
        const published = await loadPublishedQuestionnaire(db, period);
        rows = published.questions.map((question) => ({
          criteriaId: question.criteriaId,
          category: question.category,
          categoryOrder: question.categoryOrder,
          questionId: question.questionId,
          questionText: question.questionText,
          isRequired: question.isRequired ? 1 : 0,
          questionType: question.questionType,
          displayOrder: question.displayOrder,
        }));
        ratingScale = published.ratingScale;
      } else {
        const questionCount = await dbGet(
          db,
          "SELECT COUNT(*) AS count FROM evaluation_period_questions WHERE evaluationId = ?",
          [req.params.id],
        );
        rows = Number(questionCount?.count || 0) > 0
          ? await dbAll(
            db,
            `SELECT pq.criteriaId, pq.categoryName AS category, pq.categoryOrder,
                    pq.questionId, pq.questionText, pq.isRequired, pq.questionType,
                    pq.questionOrder AS displayOrder
             FROM evaluation_period_questions pq
             WHERE pq.evaluationId = ?
             ORDER BY pq.categoryOrder, pq.questionOrder, pq.questionText`,
            [req.params.id],
          )
          : await dbAll(
            db,
            `SELECT c.id AS criteriaId, c.name AS category, c.displayOrder AS categoryOrder,
                    q.id AS questionId, q.questionText, 1 AS isRequired, 'rating' AS questionType,
                    q.displayOrder
             FROM evaluation_questions q
             JOIN evaluation_criteria c ON c.id = q.criteriaId
             WHERE ${canonicalQuestionCondition}
             ORDER BY c.displayOrder, q.displayOrder, q.questionText`,
            canonicalQuestionParams,
          );
        try {
          ratingScale = JSON.parse(period.ratingScale || JSON.stringify(DEFAULT_RATING_SCALE));
        } catch {
          throw new EvaluationError(500, "The saved evaluation rating scale is invalid.");
        }
      }
      res.json(rows.map((row) => ({ ...row, ratingScale })));
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
           AND (ev.status = 'closed' OR ev.questionnaireVersion > 0)
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
           AND e.status = 'enrolled'
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
      res.json(rows.filter((row) =>
        openPeriodIds.has(row.evaluationId) || Boolean(row.completed),
      ).map((row) => ({
        ...row,
        canSubmit: openPeriodIds.has(row.evaluationId) && !row.completed,
      })));
    }),
  );

  app.post(
    "/api/evaluations/submit",
    requireRole("student"),
    asyncRoute(async (req, res) => {
      const {
        evaluationId,
        subjectOfferingId,
        answers,
        feedback,
        facultyStrengths,
        areasForImprovement,
        additionalComments,
      } = req.body || {};
      const commentFields = [facultyStrengths, areasForImprovement, additionalComments, feedback];
      if (
        typeof evaluationId !== "string" ||
        typeof subjectOfferingId !== "string" ||
        !Array.isArray(answers) ||
        answers.length > 200 ||
        commentFields.some(
          (comment) =>
            comment !== undefined &&
            comment !== null &&
            (typeof comment !== "string" || comment.length > 2000),
        )
      ) {
        return res.status(400).json({ error: "Evaluation submission details are invalid." });
      }
      const student = await findStudent(db, req.userContext);
      if (!student) return res.status(403).json({ error: "A linked student record is required." });
      const period = await dbGet(db, "SELECT * FROM faculty_evaluations WHERE id = ?", [evaluationId]);
      if (!period || !isOpen(period) || Number(period.questionnaireVersion || 0) < 1) {
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
      const published = await loadPublishedQuestionnaire(db, period);
      const questions = published.questions.map((question) => ({
        id: question.questionId,
        isRequired: question.isRequired ? 1 : 0,
        questionType: question.questionType,
      }));
      if (!questions.length || !questions.some((question) => question.isRequired)) {
        return res.status(409).json({ error: "This evaluation does not have a publishable questionnaire." });
      }
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
      if (questions.some((question) => answerMap.has(question.id) && question.questionType !== "rating")) {
        return res.status(400).json({ error: "An answer does not match the published question type." });
      }

      try {
        await withTransaction(db, async () => {
          const currentPeriod = await dbGet(
            db,
            `SELECT status, startDate, endDate, academicYearId, semesterId, questionnaireVersion
             FROM faculty_evaluations WHERE id = ?`,
            [evaluationId],
          );
          if (
            !currentPeriod ||
            !isOpen(currentPeriod) ||
            Number(currentPeriod.questionnaireVersion) !== Number(period.questionnaireVersion)
          ) {
            throw new EvaluationError(409, "This evaluation period is closed or unavailable.");
          }
          const currentOffering = await dbGet(
            db,
            `SELECT o.facultyId
             FROM subjectOfferings o
             JOIN enrollments e ON e.subjectOfferingId = o.id
             WHERE o.id = ? AND e.studentId = ? AND e.status = 'enrolled'
               AND o.academicYearId = ? AND o.semesterId = ? AND o.facultyId IS NOT NULL`,
            [
              subjectOfferingId,
              student.id,
              currentPeriod.academicYearId,
              currentPeriod.semesterId,
            ],
          );
          if (!currentOffering || currentOffering.facultyId !== offering.facultyId) {
            throw new EvaluationError(403, "You are not enrolled in this faculty assignment.");
          }
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
            `INSERT INTO evaluation_responses
             (id, evaluationId, facultyId, subjectOfferingId, feedback, facultyStrengths,
              areasForImprovement, additionalComments)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              responseId,
              evaluationId,
              currentOffering.facultyId,
              subjectOfferingId,
              String(feedback || "").trim() || null,
              String(facultyStrengths || "").trim() || null,
              String(areasForImprovement || "").trim() || null,
              String(additionalComments || feedback || "").trim() || null,
            ],
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
