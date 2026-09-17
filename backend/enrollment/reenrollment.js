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
  const match = programs.find(
    (program) => String(program.name).trim().toLowerCase() === normalized,
  );

  return match?.id ?? null;
}

/**
 * Infers the next academic target (year, semester, academic year) for a student,
 * based on their current academic context.
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
  const currentAcademicYear = String(
    context?.academicYear || `${currentYear}-${currentYear + 1}`,
  ).trim();
  const currentYearLevel = String(context?.yearLevel || "").trim();
  const currentSemester = String(context?.semester || "").trim();

  const yearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

  if (currentSemester === "1st Semester") {
    return {
      academicYear: currentAcademicYear,
      yearLevel: currentYearLevel || yearLevels[0],
      semester: "2nd Semester",
    };
  }

  const yearIndex = yearLevels.indexOf(currentYearLevel);
  const nextYearLevel =
    yearIndex >= 0 && yearIndex < yearLevels.length - 1
      ? yearLevels[yearIndex + 1]
      : currentYearLevel || yearLevels[0];

  const [startYear] = currentAcademicYear.split("-").map((value) => Number(value));
  const nextAcademicYear = Number.isFinite(startYear)
    ? `${startYear + 1}-${startYear + 2}`
    : `${currentYear}-${currentYear + 1}`;

  return {
    academicYear: nextAcademicYear,
    yearLevel: nextYearLevel,
    semester: "1st Semester",
  };
}
