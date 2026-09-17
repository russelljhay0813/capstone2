/**
 * Validates a student registration payload.
 * Checks that all required fields are present and non-empty.
 *
 * @param {Object} payload - The registration payload.
 * @returns {Object} { isValid: boolean, missing: string[] }
 */
export function validateRegistrationPayload(payload) {
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
    "program",
    "yearLevel",
    "semester",
    "academicYear",
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
export function resolveAutoApprovalStatus(currentStatus, validationResult) {
  if (validationResult?.isValid) {
    return "approved";
  }
  return String(currentStatus || "submitted");
}
