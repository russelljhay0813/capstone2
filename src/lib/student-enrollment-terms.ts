import type { StudentEnrollment } from "@/lib/api";

export interface StudentEnrollmentTerm {
  key: string;
  semester: string;
  academicYear: string;
  section: string;
  program: string;
  yearLevel: string;
  enrollments: StudentEnrollment[];
  totalUnits: number;
}

const semesterOrder = (semester: string) => {
  const value = semester.toLowerCase();
  if (value.includes("1st") || value.includes("first")) return 1;
  if (value.includes("2nd") || value.includes("second")) return 2;
  if (value.includes("summer")) return 3;
  return 4;
};

export function groupStudentEnrollments(enrollments: StudentEnrollment[]): StudentEnrollmentTerm[] {
  const groups = new Map<string, StudentEnrollmentTerm>();

  enrollments
    .filter((enrollment) => enrollment.status !== "dropped")
    .forEach((enrollment) => {
      const semester = enrollment.semesterName || enrollment.semester || "—";
      const academicYear = enrollment.academicYearCode || enrollment.academicYear || "—";
      const section = enrollment.sectionName || "—";
      const program = enrollment.programName || "";
      const yearLevel = enrollment.yearLevel || "";
      const key = [semester, academicYear, section, program, yearLevel].join("|");
      const group = groups.get(key) ?? {
        key,
        semester,
        academicYear,
        section,
        program,
        yearLevel,
        enrollments: [],
        totalUnits: 0,
      };

      group.enrollments.push(enrollment);
      group.totalUnits += enrollment.units ?? 0;
      groups.set(key, group);
    });

  return Array.from(groups.values()).sort((left, right) => {
    const leftYear = Number(left.academicYear.match(/\d{4}/)?.[0] ?? 0);
    const rightYear = Number(right.academicYear.match(/\d{4}/)?.[0] ?? 0);
    return (
      rightYear - leftYear ||
      semesterOrder(left.semester) - semesterOrder(right.semester) ||
      left.section.localeCompare(right.section)
    );
  });
}

export function studentEnrollmentTermLabel(term: StudentEnrollmentTerm): string {
  const year = term.academicYear === "—" ? "" : `, S.Y. ${term.academicYear}`;
  const details = [term.yearLevel, term.program, term.section].filter(Boolean).join(" | ");
  return `${term.semester}${year}${details ? ` | ${details}` : ""}`;
}
