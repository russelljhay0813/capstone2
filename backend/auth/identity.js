import jwt from "jsonwebtoken";

/**
 * Extracts the requesting user's identity from a verified Authorization JWT.
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
      return { role: "", userId: "", studentId: "" };
    }
  }

  return { role: "", userId: "", studentId: "" };
}
