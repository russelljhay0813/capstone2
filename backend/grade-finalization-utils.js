/**
 * Builds a query to find grades eligible for finalization.
 *
 * @param {Object} student - Student object (must contain `id` UUID)
 * @param {Object} filters - Optional filters: period, subjectId, academicYear, semester
 * @returns {{ sql: string, params: Array }} SQL query and parameters
 */
export function buildGradeFinalizationQuery(student, filters = {}) {
  // Use the student's internal UUID (students.id)
  const conditions = ["g.studentId = ?"];
  const params = [String(student?.id || "")];

  // Exclude already finalized grades
  conditions.push("g.status != ?");
  params.push("finalized");

  // Optional: filter by grading period (prelim, midterm, final, overall)
  if (filters.period) {
    conditions.push("g.period = ?");
    params.push(String(filters.period));
  }

  // Optional: filter by subject (using the subject's global ID)
  if (filters.subjectId) {
    conditions.push("sub.id = ?");
    params.push(String(filters.subjectId));
  }

  // Optional: filter by academic year (using the academic year code)
  const effectiveAcademicYear = filters.academicYear ?? student?.academicYear;
  if (effectiveAcademicYear) {
    conditions.push("ay.code = ?");
    params.push(String(effectiveAcademicYear));
  }

  // Optional: filter by semester (using the semester name)
  const effectiveSemester = filters.semester ?? student?.semester;
  if (effectiveSemester) {
    conditions.push("sem.name = ?");
    params.push(String(effectiveSemester));
  }

  // Build the query – joins to get subject, academic year, and semester via the offering
  const sql = `
    SELECT
      g.id,
      g.studentId,
      g.subjectOfferingId,
      g.period,
      g.status
    FROM grades g
    JOIN subjectOfferings so ON so.id = g.subjectOfferingId
    JOIN subjects sub ON sub.id = so.subjectId
    JOIN academicYears ay ON ay.id = so.academicYearId
    JOIN semesters sem ON sem.id = so.semesterId
    WHERE ${conditions.join(" AND ")}
  `;

  return { sql, params };
}