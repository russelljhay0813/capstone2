/**
 * Resolves a program ID from a program name.
 *
 * @param {string} programName - The name of the program (e.g., "Diploma in Hospitality")
 * @param {Array} programs - Array of program objects, each with { id, name }
 * @returns {string|null} The program ID, or null if not found
 */
export function resolveProgramIdForStudent(programName, programs = []) {
  if (!programName) return null;

  const normalized = String(programName).trim().toLowerCase();

  // Find the first program whose name matches (case‑insensitive)
  const match = programs.find(
    (program) => String(program.name).trim().toLowerCase() === normalized
  );

  return match?.id ?? null;
}

/**
 * Infers the next academic target (year, semester, academic year) for a student,
 * based on their current academic context.
 *
 * In the new schema, the student’s current context is not stored on the student record;
 * instead, it is derived from their latest enrollment. So this function expects
 * the current context to be passed in (e.g., from `getStudentCurrentContext`).
 *
 * @param {Object} context - The current academic context of the student.
 *   @param {string} context.academicYear - e.g., "2025-2026"
 *   @param {string} context.yearLevel - e.g., "1st Year"
 *   @param {string} context.semester - e.g., "1st Semester"
 * @param {number} currentYear - The current calendar year (defaults to new Date().getFullYear()).
 * @returns {Object} The inferred next target:
 *   { academicYear, yearLevel, semester }
 */
export function inferReenrollmentTarget(context, currentYear = new Date().getFullYear()) {
  // Use provided context, or fallback to current year + default values
  const currentAcademicYear = String(
    context?.academicYear || `${currentYear}-${currentYear + 1}`
  ).trim();
  const currentYearLevel = String(context?.yearLevel || "").trim();
  const currentSemester = String(context?.semester || "").trim();

  const yearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

  // If currently in 1st Semester → advance to 2nd Semester of the same year
  if (currentSemester === "1st Semester") {
    return {
      academicYear: currentAcademicYear,
      yearLevel: currentYearLevel || yearLevels[0],
      semester: "2nd Semester",
    };
  }

  // Otherwise (2nd Semester, Summer, or unknown) → advance to next year, 1st Semester
  const yearIndex = yearLevels.indexOf(currentYearLevel);
  const nextYearLevel =
    yearIndex >= 0 && yearIndex < yearLevels.length - 1
      ? yearLevels[yearIndex + 1]
      : currentYearLevel || yearLevels[0];

  // Increment the academic year (e.g., "2025-2026" → "2026-2027")
  const [startYear] = currentAcademicYear.split("-").map((v) => Number(v));
  const nextAcademicYear = Number.isFinite(startYear)
    ? `${startYear + 1}-${startYear + 2}`
    : `${currentYear}-${currentYear + 1}`;

  return {
    academicYear: nextAcademicYear,
    yearLevel: nextYearLevel,
    semester: "1st Semester",
  };
}