import jwt from "jsonwebtoken";

/**
 * Extracts the requesting user's identity from the Authorization header
 * or fallback request headers.
 *
 * In the new schema:
 * - `userId` corresponds to `users.id` (UUID)
 * - `studentId` corresponds to `students.studentId` (human‑readable, optional)
 *
 * @param {Object} req - Express request object
 * @param {string} jwtSecret - Secret key used to verify JWT tokens
 * @returns {{ role: string, userId: string, studentId: string }}
 */
export function resolveRequestIdentity(req, jwtSecret) {
  const authHeader = req.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (token) {
    try {
      const payload = jwt.verify(token, jwtSecret);
      return {
        role: String(payload.role || "").toLowerCase(),
        userId: String(payload.id || ""),
        studentId: String(payload.studentId || ""),
      };
    } catch {
      // Token invalid – fall through to header-based identity
    }
  }

  const roleHeader = String(req.get("x-user-role") || "").toLowerCase();
  const userIdHeader = String(req.get("x-user-id") || "");
  const studentIdHeader = String(req.get("x-user-student-id") || "");

  if (roleHeader) {
    return {
      role: roleHeader,
      userId: userIdHeader,
      studentId: studentIdHeader,
    };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      role: "",
      userId: "",
      studentId: "",
    };
  }

  return {
    role: "admin",
    userId: "local-dev",
    studentId: "",
  };
}
