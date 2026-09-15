import { useEffect, useState, useCallback } from "react";
import { fetchGrades, saveGrade, deleteGradeApi, type GradeEntry } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const EVENT = "bwest:grades-changed";

function broadcastUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

let eventSource: EventSource | null = null;

function ensureGradeEventSource() {
  if (typeof window === "undefined") return;
  if (!eventSource) {
    eventSource = new EventSource(`${API_BASE}/api/events/grades`);
    eventSource.onmessage = () => {
      window.dispatchEvent(new CustomEvent(EVENT));
    };
    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }
}

export async function addOrUpdateGrade(
  studentId: string,        // human-readable
  subjectOfferingId: string,
  grade: number,
  remarks?: string,
  period?: "prelim" | "midterm" | "final" | "overall",
  type?: "activity" | "quiz" | "exam" | "overall",
  component?: string,
  status?: GradeEntry["status"],
): Promise<GradeEntry> {
  const saved = await saveGrade({
    studentId,
    subjectOfferingId,
    grade,
    remarks,
    period,
    type,
    component,
    status,
  });
  broadcastUpdate();
  return saved;
}

export async function removeGrade(studentId: string, subjectOfferingId: string): Promise<void> {
  await deleteGradeApi(studentId, subjectOfferingId);
  broadcastUpdate();
}

export function getGradesByOffering(grades: GradeEntry[], offeringId: string): GradeEntry[] {
  return grades.filter((g) => g.subjectOfferingId === offeringId);
}

export function getGradeByStudentAndOffering(
  grades: GradeEntry[],
  studentId: string,
  offeringId: string,
): GradeEntry | null {
  return grades.find((g) => g.studentId === studentId && g.subjectOfferingId === offeringId) ?? null;
}

export function useGrades() {
  const [grades, setGrades] = useState<GradeEntry[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchGrades();
      setGrades(data);
    } catch {
      setGrades([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    ensureGradeEventSource();
    const onChange = () => {
      refresh();
    };
    window.addEventListener(EVENT, onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
    };
  }, [refresh]);

  return grades;
}

export function useStudentGrades(studentId: string) {
  const [grades, setGrades] = useState<GradeEntry[]>([]);

  const refresh = useCallback(async () => {
    if (!studentId) {
      setGrades([]);
      return;
    }
    try {
      const data = await fetchGrades(undefined, studentId);
      setGrades(data);
    } catch {
      setGrades([]);
    }
  }, [studentId]);

  useEffect(() => {
    refresh();
    ensureGradeEventSource();
    const onChange = () => {
      refresh();
    };
    window.addEventListener(EVENT, onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
    };
  }, [refresh]);

  return grades;
}