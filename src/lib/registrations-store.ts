import { useEffect, useState, useCallback } from "react";
import {
  fetchStudents,
  createStudent,
  updateStudent,
  loginStudent,
  fetchCurriculum,
  fetchSubjects,
  fetchSubjectOfferings,
  createEnrollments,
  fetchSections,
  createSection,
  createSubjectOffering,
  fetchProgramsDetailed,
  fetchAcademicStructure,
  type StudentRegistration as ApiStudentRegistration,
  type StudentRegistrationPayload,
  type Section,
} from "./api";
import { YEAR_LEVELS, SEMESTERS } from "@/lib/subjects-store";

export type RegistrationStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected";

export interface StudentRegistration extends ApiStudentRegistration {}

export const REGISTRATIONS_EVENT = "bwest:registrations-changed";

function broadcastUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REGISTRATIONS_EVENT));
}

export async function getRegistrations(): Promise<StudentRegistration[]> {
  return fetchStudents();
}

export async function getPending(): Promise<StudentRegistration[]> {
  return fetchStudents("pending");
}

export async function getApprovedStudents(): Promise<StudentRegistration[]> {
  return fetchStudents("approved");
}

export async function findApprovedByEmail(
  email: string,
  password: string,
): Promise<StudentRegistration | null> {
  try {
    const student = await loginStudent(email, password);
    return student.status === "approved" ? student : null;
  } catch {
    return null;
  }
}

export async function emailExists(email: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/email-exists?email=${encodeURIComponent(email)}`);
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.exists);
  } catch {
    return false;
  }
}

export async function submitRegistration(
  data: StudentRegistrationPayload & { studentId?: string },
): Promise<StudentRegistration> {
  const created = data.studentId
    ? await updateStudent(data.studentId, { ...data, status: data.status ?? "approved" })
    : await createStudent(data);
  broadcastUpdate();
  return created;
}

// Helper: find or create a section
async function getOrCreateSection(
  programId: string,
  yearLevel: string,
  semesterId: string,
  academicYearId: string,
): Promise<Section> {
  const sections = await fetchSections();
  let section = sections.find(
    (s) =>
      s.programId === programId &&
      s.yearLevel === yearLevel &&
      s.semesterId === semesterId &&
      s.academicYearId === academicYearId,
  );
  if (!section) {
    // Create a default section
    const code = `${yearLevel.slice(0, 2)}-${semesterId.slice(0, 2)}-${programId.slice(0, 4)}`;
    const name = `${yearLevel} ${semesterId}`;
    section = await createSection({
      code,
      name,
      programId,
      yearLevel,
      semesterId,
      academicYearId,
    });
  }
  return section;
}

export async function approveRegistration(id: string, note?: string) {
  const all = await getRegistrations();
  const reg = all.find((r) => r.id === id);
  if (!reg) return;

  // Update student status to approved
  await updateStudent(reg.studentId, {
    status: "approved",
    reviewedAt: new Date().toISOString(),
    reviewNote: note,
  });

  // Determine program ID from program name
  const programs = await fetchProgramsDetailed();
  const program = programs.find((p) => p.name === reg.program);
  if (!program) {
    console.warn("Program not found for auto-enrollment");
    return;
  }

  const studentYearLevel = reg.yearLevel || YEAR_LEVELS[0];
  const studentSemester = reg.semester || SEMESTERS[0];
  const studentAcademicYear =
    reg.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  // Get academic year and semester IDs
  const structure = await fetchAcademicStructure();
  const academicYearId = structure.academicYears.find((y) => y === studentAcademicYear);
  const semesterId = structure.semesters.find((s) => s === studentSemester);
  if (!academicYearId || !semesterId) {
    console.warn("Academic year or semester not found");
    return;
  }

  // Get or create section
  const section = await getOrCreateSection(
    program.id,
    studentYearLevel,
    semesterId,
    academicYearId,
  );

  // Get curriculum subjects for this program/year/semester
  const curriculumItems = await fetchCurriculum({ programId: program.id });
  const subjectCodes = curriculumItems
    .filter((c) => c.yearLevel === studentYearLevel && c.semester === studentSemester)
    .map((c) => c.subjectCode)
    .filter((code): code is string => Boolean(code));

  // Get subject IDs for these codes
  const allSubjects = await fetchSubjects();
  const subjectIds = allSubjects
    .filter((s) => subjectCodes.includes(s.code))
    .map((s) => s.id);

  if (subjectIds.length === 0) {
    console.warn("No subjects found for curriculum");
    return;
  }

  // Find or create offerings for these subjects in the section
  const existingOfferings = await fetchSubjectOfferings({
    sectionId: section.id,
    academicYear: studentAcademicYear,
    semester: studentSemester,
  });
  const existingSubjectIds = existingOfferings.map((o) => o.subjectId);
  const missingSubjectIds = subjectIds.filter((sid) => !existingSubjectIds.includes(sid));

  // Create missing offerings (without faculty assignment)
  for (const sid of missingSubjectIds) {
    await createSubjectOffering({
      subjectId: sid,
      academicYearId: section.academicYearId,
      semesterId: section.semesterId,
      sectionId: section.id,
      schedule: "TBA",
      room: "TBA",
    });
  }

  // Fetch all offerings for this section again
  const allOfferings = await fetchSubjectOfferings({
    sectionId: section.id,
    academicYear: studentAcademicYear,
    semester: studentSemester,
  });
  const offeringIds = allOfferings.map((o) => o.id);

  if (offeringIds.length > 0) {
    await createEnrollments({
      studentId: reg.studentId,
      offeringIds,
    });
  }

  broadcastUpdate();
}

export async function rejectRegistration(id: string, note?: string) {
  const all = await getRegistrations();
  const reg = all.find((r) => r.id === id);
  if (!reg) return;
  await updateStudent(reg.studentId, {
    status: "rejected",
    reviewedAt: new Date().toISOString(),
    reviewNote: note,
  });
  broadcastUpdate();
}

export function useRegistrations() {
  const [registrations, setRegistrations] = useState<StudentRegistration[]>([]);

  const refresh = useCallback(async () => {
    try {
      setRegistrations(await getRegistrations());
    } catch {
      setRegistrations([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(REGISTRATIONS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(REGISTRATIONS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return registrations;
}