import { useRegistrations, type StudentRegistration } from "./registrations-store";

export type Student = StudentRegistration;

/**
 * Hook to get all students (both pending and approved).
 * This is a convenience wrapper around useRegistrations.
 */
export function useStudents(): Student[] {
  const registrations = useRegistrations();
  return registrations;
}

/**
 * Hook to get only approved/active students.
 */
export function useActiveStudents(): Student[] {
  const registrations = useRegistrations();
  return registrations.filter(
    (s) => s.status === "approved" || s.status === "active"
  );
}

/**
 * Hook to get pending students (awaiting approval).
 */
export function usePendingStudents(): Student[] {
  const registrations = useRegistrations();
  return registrations.filter(
    (s) => s.status === "pending" || s.status === "submitted" || s.status === "under_review"
  );
}