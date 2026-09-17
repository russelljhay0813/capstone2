import crypto from "crypto";

/**
 * Builds a payload object for inserting/updating an attendance record.
 * Uses the new normalized schema (student UUID, subjectOffering UUID, no denormalized fields).
 *
 * @param {Object} params
 * @param {string} params.studentUuid - The student's internal UUID (students.id)
 * @param {string} params.subjectOfferingId - The subject offering UUID (subjectOfferings.id)
 * @param {string} params.date - The date of the attendance (ISO string, e.g., "2025-01-15")
 * @param {string} params.status - The attendance status ('present', 'absent', 'late', 'excused')
 * @param {string} [params.time] - Optional time (e.g., "08:30") – defaults to current HH:MM
 * @returns {Object} Attendance record payload with generated id and updatedAt.
 */
export function buildAttendanceRecordPayload({
  studentUuid,
  subjectOfferingId,
  date,
  status,
  time,
}) {
  if (!studentUuid || !subjectOfferingId || !date || !status) {
    throw new Error(
      "Missing required fields: studentUuid, subjectOfferingId, date, and status are required",
    );
  }

  const formattedTime = time ?? new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    id: crypto.randomUUID(),
    studentId: String(studentUuid),
    subjectOfferingId: String(subjectOfferingId),
    date: String(date),
    time: formattedTime,
    status: String(status),
    updatedAt: Date.now(),
  };
}
