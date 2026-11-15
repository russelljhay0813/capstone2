import { useEffect, useState, useCallback } from "react";
import {
  fetchEnrollments as apiFetchEnrollments,
  createEnrollments,
  fetchSubjectOfferings,
  type StudentEnrollment,
  type SubjectOffering,
} from "./api";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
export const ENROLLMENT_EVENT = "bwest:enrollments-changed";

function broadcastUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ENROLLMENT_EVENT));
}

export async function fetchEnrollments(
  studentId?: string,
  offeringId?: string,
  status?: string,
): Promise<StudentEnrollment[]> {
  return apiFetchEnrollments(studentId, offeringId, status);
}

export async function enrollStudent(
  studentId: string,        // human-readable
  offeringIds: string[],
): Promise<StudentEnrollment[]> {
  const enrollments = await createEnrollments({ studentId, offeringIds });
  broadcastUpdate();
  return enrollments;
}

// Hook: get all enrollments (optionally filtered by student)
export function useEnrollments(studentId?: string) {
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchEnrollments(studentId);
      setEnrollments(data);
    } catch {
      setEnrollments([]);
    }
  }, [studentId]);

  useEffect(() => {
    refresh();
    const onChange = () => {
      refresh();
    };
    window.addEventListener(ENROLLMENT_EVENT, onChange);
    return () => window.removeEventListener(ENROLLMENT_EVENT, onChange);
  }, [refresh]);

  return enrollments;
}

// Hook: get student's enrollments with offering details
export function useStudentEnrollments(studentId: string) {
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);

  const refresh = useCallback(async () => {
    if (!studentId) {
      setEnrollments([]);
      return;
    }
    try {
      const data = await fetchEnrollments(studentId);
      setEnrollments(data);
    } catch {
      setEnrollments([]);
    }
  }, [studentId]);

  useEffect(() => {
    refresh();
    const onChange = () => {
      refresh();
    };
    window.addEventListener(ENROLLMENT_EVENT, onChange);
    return () => window.removeEventListener(ENROLLMENT_EVENT, onChange);
  }, [refresh]);

  return enrollments;
}

// Hook: get subject offerings the student is enrolled in
export function useEnrolledOfferings(studentId: string): SubjectOffering[] {
  const [offerings, setOfferings] = useState<SubjectOffering[]>([]);

  useEffect(() => {
    const refresh = async () => {
      if (!studentId) {
        setOfferings([]);
        return;
      }
      try {
        const [enrollments, allOfferings] = await Promise.all([
          fetchEnrollments(studentId),
          fetchSubjectOfferings(),
        ]);
        const offeringIds = enrollments.map((e) => e.subjectOfferingId);
        setOfferings(allOfferings.filter((o) => offeringIds.includes(o.id)));
      } catch {
        setOfferings([]);
      }
    };
    refresh();
    const onChange = () => {
      refresh();
    };
    window.addEventListener(ENROLLMENT_EVENT, onChange);
    return () => {
      window.removeEventListener(ENROLLMENT_EVENT, onChange);
    };
  }, [studentId]);

  return offerings;
}