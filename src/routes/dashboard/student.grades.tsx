import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchEnrollments, fetchGrades, type GradeEntry, type StudentEnrollment } from "@/lib/api";
import {
  groupStudentEnrollments,
  studentEnrollmentTermLabel,
} from "@/lib/student-enrollment-terms";

export const Route = createFileRoute("/dashboard/student/grades")({
  component: StudentGrades,
});

function finalGradeForOffering(grades: GradeEntry[], offeringId: string): GradeEntry | null {
  const finalGrades = grades.filter(
    (grade) =>
      grade.subjectOfferingId === offeringId &&
      grade.status !== "draft" &&
      (grade.period === "final" || grade.type === "overall"),
  );
  return (
    finalGrades.find((grade) => grade.status === "finalized") ??
    finalGrades.find((grade) => grade.period === "final") ??
    finalGrades[0] ??
    null
  );
}

function StudentGrades() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    const loadData = async () => {
      if (!user?.studentId) {
        setEnrollments([]);
        setGrades([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [enrollmentData, gradeData] = await Promise.all([
          fetchEnrollments({ studentId: user.studentId }),
          fetchGrades({ studentId: user.studentId }),
        ]);
        if (isCurrent) {
          setEnrollments(enrollmentData);
          setGrades(gradeData);
        }
      } catch {
        if (isCurrent) {
          setEnrollments([]);
          setGrades([]);
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    void loadData();
    return () => {
      isCurrent = false;
    };
  }, [user?.studentId]);

  const terms = groupStudentEnrollments(enrollments);

  return (
    <div className="space-y-4">
      <div>
        <button
          onClick={() => navigate({ to: "/dashboard/student/enrollment" })}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          ‹ &nbsp; Back to Subjects
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead className="bg-sky-200 text-center text-[13px] font-semibold text-slate-800">
              <tr>
                <th rowSpan={2} className="px-4 py-3">
                  Units
                </th>
                <th rowSpan={2} className="px-4 py-3">
                  Subject Code
                </th>
                <th rowSpan={2} className="px-4 py-3 text-left">
                  Description
                </th>
                <th colSpan={2} className="px-4 pb-1 pt-2">
                  Grades
                </th>
                <th rowSpan={2} className="px-4 py-3">
                  Remarks
                </th>
              </tr>
              <tr>
                <th className="px-4 pb-3 pt-1">Final</th>
                <th className="px-4 pb-3 pt-1">Re-Exam</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Loading grades...
                  </td>
                </tr>
              ) : terms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No subject enrollments are available to display.
                  </td>
                </tr>
              ) : (
                terms.map((term) => (
                  <Fragment key={term.key}>
                    <tr className="bg-slate-200 text-slate-700">
                      <td colSpan={6} className="px-4 py-2 italic">
                        {studentEnrollmentTermLabel(term)}
                      </td>
                    </tr>
                    {term.enrollments.map((enrollment) => {
                      const grade = finalGradeForOffering(grades, enrollment.subjectOfferingId);
                      return (
                        <tr key={enrollment.id} className="border-b border-slate-200 last:border-0">
                          <td className="px-4 py-3 text-center">{enrollment.units ?? 0}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {enrollment.subjectCode || "—"}
                          </td>
                          <td className="max-w-[420px] truncate px-4 py-3">
                            {enrollment.subjectTitle || "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {grade ? grade.grade.toFixed(2) : "--"}
                          </td>
                          <td className="px-4 py-3 text-center">--</td>
                          <td className="px-4 py-3 text-center">{grade?.remarks || "--"}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
