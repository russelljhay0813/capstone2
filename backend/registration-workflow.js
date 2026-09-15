/**
 * Validates a student registration payload.
 * Checks that all required fields are present and non-empty.
 *
 * In the new schema, these fields are used to determine initial enrollment,
 * but are not stored directly on the student record (they go into enrollments
 * via sections and subjectOfferings). However, they are still required for
 * registration to auto-enroll the student.
 *
 * @param {Object} payload - The registration payload.
 * @returns {Object} { isValid: boolean, missing: string[] }
 */
function validateRegistrationPayload(payload) {
  const requiredFields = [
    "firstName",
    "lastName",
    "gender",
    "dob",
    "civilStatus",
    "nationality",
    "email",
    "contactNumber",
    "address",
    "region",
    "province",
    "city",
    "barangay",
    "zip",
    "parentName",
    "parentRelationship",
    "parentContact",
    "program",        // Used to find the program ID
    "yearLevel",      // Used to find/create section
    "semester",       // Used to find/create section
    "academicYear",   // Used to find/create section
  ];

  const missing = requiredFields.filter((field) => {
    const value = payload?.[field];
    return value === undefined || value === null || (typeof value === "string" && !value.trim());
  });

  return {
    isValid: missing.length === 0,
    missing,
  };
}

/**
 * Determines the next status for a student registration.
 * If the payload is valid, sets status to 'approved'; otherwise keeps current status.
 *
 * @param {string} currentStatus - The current status (e.g., 'submitted').
 * @param {Object} validationResult - Result from validateRegistrationPayload.
 * @returns {string} The resolved status.
 */
function resolveAutoApprovalStatus(currentStatus, validationResult) {
  if (validationResult?.isValid) {
    return "approved";
  }
  return String(currentStatus || "submitted");
}

export { validateRegistrationPayload, resolveAutoApprovalStatus };