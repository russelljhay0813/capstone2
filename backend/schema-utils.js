/**
 * Normalize a student payload to match the new `students` table schema.
 * Only fields that exist in the `students` table are included.
 * Academic fields (program, yearLevel, semester, etc.) are NOT stored here.
 *
 * @param {Object} input - Raw student data.
 * @returns {Object} Normalized student object ready for database insertion.
 */
export function normalizeStudentPayload(input = {}) {
  // Helper to safely convert to integer timestamp
  const toTimestamp = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  return {
    id: input.id ?? null,
    studentId: input.studentId ?? null,
    userId: input.userId ?? null,
    firstName: input.firstName ? String(input.firstName).trim() : "",
    lastName: input.lastName ? String(input.lastName).trim() : "",
    middleName: input.middleName ? String(input.middleName).trim() : null,
    suffix: input.suffix ? String(input.suffix).trim() : null,
    email: input.email ? String(input.email).trim().toLowerCase() : "",
    password: input.password ?? null,
    gender: input.gender ? String(input.gender) : null,
    dob: input.dob ? String(input.dob) : null,
    civilStatus: input.civilStatus ? String(input.civilStatus) : null,
    nationality: input.nationality ? String(input.nationality) : null,
    religion: input.religion ? String(input.religion) : null,
    educationLevel: input.educationLevel ? String(input.educationLevel) : "",
    previousSchool: input.previousSchool ? String(input.previousSchool).trim() : null,
    lastGrade: input.lastGrade ? String(input.lastGrade).trim() : null,
    contactNumber: input.contactNumber ? String(input.contactNumber).trim() : null,
    address: input.address ? String(input.address).trim() : null,
    region: input.region ? String(input.region).trim() : null,
    city: input.city ? String(input.city).trim() : null,
    province: input.province ? String(input.province).trim() : null,
    zip: input.zip ? String(input.zip).trim() : null,
    fatherName: input.fatherName ? String(input.fatherName).trim() : null,
    fatherOccupation: input.fatherOccupation ? String(input.fatherOccupation).trim() : null,
    fatherContact: input.fatherContact ? String(input.fatherContact).trim() : null,
    motherName: input.motherName ? String(input.motherName).trim() : null,
    motherOccupation: input.motherOccupation ? String(input.motherOccupation).trim() : null,
    motherContact: input.motherContact ? String(input.motherContact).trim() : null,
    guardianName: input.guardianName ? String(input.guardianName).trim() : null,
    guardianOccupation: input.guardianOccupation ? String(input.guardianOccupation).trim() : null,
    guardianContact: input.guardianContact ? String(input.guardianContact).trim() : null,
    guardianRelation: input.guardianRelation ? String(input.guardianRelation).trim() : null,
    parentName: input.parentName ? String(input.parentName).trim() : null,
    parentContact: input.parentContact ? String(input.parentContact).trim() : null,
    parentAddress: input.parentAddress ? String(input.parentAddress).trim() : null,
    emergencyName: input.emergencyName ? String(input.emergencyName).trim() : null,
    emergencyContact: input.emergencyContact ? String(input.emergencyContact).trim() : null,
    emergencyAddress: input.emergencyAddress ? String(input.emergencyAddress).trim() : null,
    emergencyRelation: input.emergencyRelation ? String(input.emergencyRelation).trim() : null,
    placeOfBirth: input.placeOfBirth ? String(input.placeOfBirth).trim() : null,
    barangay: input.barangay ? String(input.barangay).trim() : null,
    parentRelationship: input.parentRelationship ? String(input.parentRelationship).trim() : null,
    status: input.status ? String(input.status) : "pending",
    submittedAt: toTimestamp(input.submittedAt) ?? Date.now(),
    reviewedAt: toTimestamp(input.reviewedAt) ?? null,
    reviewNote: input.reviewNote ?? null,
    firstLoginAt: toTimestamp(input.firstLoginAt) ?? null,
    lastLoginAt: toTimestamp(input.lastLoginAt) ?? null,
  };
}

/**
 * Normalize a user payload to match the new `users` table schema.
 * Academic fields are removed; only user‑login related fields remain.
 *
 * @param {Object} input - Raw user data.
 * @returns {Object} Normalized user object ready for database insertion.
 */
export function normalizeUserPayload(input = {}) {
  const toTimestamp = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  return {
    id: input.id ?? null,
    userId: input.userId ?? null,
    username: input.username ? String(input.username).trim() : null,
    email: input.email ? String(input.email).trim().toLowerCase() : "",
    password: input.password ?? null,
    firstName: input.firstName ? String(input.firstName).trim() : "",
    middleName: input.middleName ? String(input.middleName).trim() : null,
    lastName: input.lastName ? String(input.lastName).trim() : "",
    role: input.role ? String(input.role) : "student",
    status: input.status ? String(input.status) : "active",
    createdAt: toTimestamp(input.createdAt) ?? Date.now(),
    temporaryPassword: input.temporaryPassword ?? null,
    firstLoginAt: toTimestamp(input.firstLoginAt) ?? null,
    lastLoginAt: toTimestamp(input.lastLoginAt) ?? null,
  };
}