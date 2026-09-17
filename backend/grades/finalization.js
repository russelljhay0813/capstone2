/**
 * Builds a query to find grades eligible for finalization.
 *
 * @param {Object} student - Student object (must contain `id` UUID)
 * @param {Object} filters - Optional filters: period, subjectId, academicYear, semester
 * @returns {{ sql: string, params: Array }} SQL query and parameters
 */
export function buildGradeFinalizationQuery(student, filters = {}) {
  const conditions = ["g.studentId = ?"];
  const params = [String(student?.id || "")];

  conditions.push("g.status != ?");
  params.push("finalized");

  if (filters.period) {
    conditions.push("g.period = ?");
    params.push(String(filters.period));
  }

  if (filters.subjectId) {
    conditions.push("sub.id = ?");
    params.push(String(filters.subjectId));
  }

  const effectiveAcademicYear = filters.academicYear ?? student?.academicYear;
  if (effectiveAcademicYear) {
    conditions.push("ay.code = ?");
    params.push(String(effectiveAcademicYear));
  }

  const effectiveSemester = filters.semester ?? student?.semester;
  if (effectiveSemester) {
    conditions.push("sem.name = ?");
    params.push(String(effectiveSemester));
  }

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
