import { useEffect, useState, useCallback } from "react";
import {
  fetchSubjects as apiFetchSubjects,
  createSubject as apiCreateSubject,
  updateSubjectApi as apiUpdateSubject,
  deleteSubjectApi as apiDeleteSubject,
  fetchSubjectOfferings as apiFetchOfferings,
  createSubjectOffering as apiCreateOffering,
  updateSubjectOffering as apiUpdateOffering,
  deleteSubjectOffering as apiDeleteOffering,
  fetchCurriculum,
  type Subject,
  type SubjectOffering,
  type CurriculumItem,
} from "./api";

export { type Subject, type SubjectOffering, type CurriculumItem };

const EVENT = "bwest:subjects-changed";
const OFFERING_EVENT = "bwest:offerings-changed";

function broadcastUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

function broadcastOfferingUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFERING_EVENT));
}

// ---------- GLOBAL SUBJECTS ----------
export async function fetchSubjects(): Promise<Subject[]> {
  return apiFetchSubjects();
}

export async function createSubject(subject: Omit<Subject, "id">): Promise<Subject> {
  const created = await apiCreateSubject({
    ...subject,
    description: subject.description ?? undefined,
  });
  broadcastUpdate();
  return created;
}

export async function updateSubject(
  id: string,
  patch: Partial<Omit<Subject, "id">>,
): Promise<Subject | null> {
  const updated = await apiUpdateSubject(id, patch);
  broadcastUpdate();
  return updated;
}

export async function removeSubject(id: string): Promise<void> {
  await apiDeleteSubject(id);
  broadcastUpdate();
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSubjects();
      setSubjects(data);
    } catch {
      setSubjects([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [refresh]);

  return subjects;
}

// ---------- SUBJECT OFFERINGS ----------
export async function fetchOfferings(filters?: {
  academicYear?: string;
  semester?: string;
  sectionId?: string;
  facultyId?: string;
  subjectId?: string;
}): Promise<SubjectOffering[]> {
  return apiFetchOfferings(filters);
}

export async function createOffering(
  offering: Omit<SubjectOffering, "id" | "createdAt" | "status">,
): Promise<SubjectOffering> {
  const created = await apiCreateOffering({
    ...offering,
    facultyId: offering.facultyId ?? undefined,
    schedule: offering.schedule ?? undefined,
    room: offering.room ?? undefined,
    capacity: offering.capacity ?? undefined,
  });
  broadcastOfferingUpdate();
  return created;
}

export async function updateOffering(
  id: string,
  patch: Partial<Omit<SubjectOffering, "id" | "createdAt">>,
): Promise<SubjectOffering> {
  const updated = await apiUpdateOffering(id, {
    ...patch,
    facultyId: patch.facultyId ?? null,
    schedule: patch.schedule ?? null,
    room: patch.room ?? null,
    capacity: patch.capacity ?? null,
  });
  broadcastOfferingUpdate();
  return updated;
}

export async function removeOffering(id: string): Promise<void> {
  await apiDeleteOffering(id);
  broadcastOfferingUpdate();
}

export function useOfferings(filters?: {
  academicYear?: string;
  semester?: string;
  sectionId?: string;
  facultyId?: string;
  subjectId?: string;
}) {
  const [offerings, setOfferings] = useState<SubjectOffering[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchOfferings(filters);
      setOfferings(data);
    } catch {
      setOfferings([]);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(OFFERING_EVENT, onChange);
    return () => window.removeEventListener(OFFERING_EVENT, onChange);
  }, [refresh]);

  return offerings;
}

// ---------- CURRICULUM HELPERS ----------
export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
export const SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];

export function useCurriculum() {
  const [curriculum, setCurriculum] = useState<CurriculumItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchCurriculum();
      setCurriculum(data);
    } catch {
      setCurriculum([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return curriculum;
}

export async function getCurriculumSubjects(
  program: string,
  yearLevel: string,
  semester: string,
): Promise<{ subjectId: string; code: string; title: string; units: number }[]> {
  const items = await fetchCurriculum({ program });
  return items
    .filter((c) => c.yearLevel === yearLevel && c.semester === semester)
    .map((c) => ({
      subjectId: c.subjectId,
      code: c.subjectCode || "",
      title: c.subjectTitle || "",
      units: c.units || 0,
    }));
}