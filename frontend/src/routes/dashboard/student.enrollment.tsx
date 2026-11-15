import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEnrollments } from "@/lib/enrollment-store";
import { useGrades } from "@/lib/grades-store";
import { fetchCurriculum, reenrollStudent } from "@/lib/api";
import { Fragment, useState, useEffect } from "react";
import {
  groupStudentEnrollments,
  studentEnrollmentTermLabel,
} from "@/lib/student-enrollment-terms";

export const Route = createFileRoute("/dashboard/student/enrollment")({
  component: StudentEnrollment,
});

function StudentEnrollment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const enrollments = useEnrollments(user?.studentId ?? "");
  const grades = useGrades();
  const [showReenrollModal, setShowReenrollModal] = useState(false);
  const [canReenroll, setCanReenroll] = useState(false);
  const [nextSemesterInfo, setNextSemesterInfo] = useState<{
    yearLevel: string;
    semester: string;
  } | null>(null);
  const [curriculumSubjects, setCurriculumSubjects] = useState<
    { code: string; title: string; units: number }[]
  >([]);

  const program = user?.program || "";
  const terms = groupStudentEnrollments(enrollments);

  // Check reenrollment eligibility: all enrolled offerings have finalized grades
  useEffect(() => {
    const activeEnrollments = enrollments.filter((enrollment) => enrollment.status !== "dropped");
    if (!user?.studentId || activeEnrollments.length === 0) {
      setCanReenroll(false);
      return;
    }

    const allGradesSubmitted = activeEnrollments.every((enrollment) => {
      const grade = grades.find(
        (g) =>
          g.studentId === user.studentId && g.subjectOfferingId === enrollment.subjectOfferingId,
      );
      return grade && grade.status !== "draft";
    });

    if (allGradesSubmitted) {
      setCanReenroll(true);
      // Determine next semester/year from the latest enrollment (or from student profile)
      const currentSemester = user?.semester || "1st Semester";
      const currentYear = user?.yearLevel || "1st Year";
      const semesters = ["1st Semester", "2nd Semester", "Summer"];
      const yearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

      let nextSem = currentSemester;
      let nextYear = currentYear;
      const semIdx = semesters.indexOf(currentSemester);
      if (semIdx < semesters.length - 1) {
        nextSem = semesters[semIdx + 1];
      } else {
        // Last semester → move to next year
        nextSem = semesters[0];
        const yearIdx = yearLevels.indexOf(currentYear);
        if (yearIdx < yearLevels.length - 1) {
          nextYear = yearLevels[yearIdx + 1];
        }
      }
      setNextSemesterInfo({ yearLevel: nextYear, semester: nextSem });
    }
  }, [user?.studentId, user?.semester, user?.yearLevel, enrollments, grades]);

  useEffect(() => {
    const loadCurriculum = async () => {
      if (!nextSemesterInfo || !user?.program) {
        setCurriculumSubjects([]);
        return;
      }
      try {
        const items = await fetchCurriculum({
          program: user.program,
          yearLevel: nextSemesterInfo.yearLevel,
          semester: nextSemesterInfo.semester,
        });
        setCurriculumSubjects(
          items.map((item) => ({
            code: item.subjectCode ?? "",
            title: item.subjectTitle ?? "",
            units: item.units ?? 0,
          })),
        );
      } catch {
        setCurriculumSubjects([]);
      }
    };
    loadCurriculum();
  }, [user?.program, nextSemesterInfo]);

  const handleReenroll = async () => {
    if (!nextSemesterInfo || !user?.studentId) return;
    try {
      await reenrollStudent(user.studentId, {
        nextYear: nextSemesterInfo.yearLevel,
        nextSemester: nextSemesterInfo.semester,
      });
      setShowReenrollModal(false);
      import("sonner").then(({ toast }) => {
        toast.success("Re-enrollment submitted successfully.");
      });
    } catch (err: unknown) {
      import("sonner").then(({ toast }) => {
        toast.error(err instanceof Error ? err.message : "Failed to submit re-enrollment request.");
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        {canReenroll && (
          <button
            onClick={() => setShowReenrollModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" /> Apply for Re-enrollment
          </button>
        )}
        <button
          onClick={() => navigate({ to: "/dashboard/student/grades" })}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Student&apos;s Grade
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-xs">
            <thead className="bg-primary text-left text-[13px] font-semibold text-primary-foreground">
              <tr>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3">Subject Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Instructor</th>
                <th className="px-4 py-3 text-center">Evaluation Form</th>
                <th className="px-4 py-3 text-center">Others</th>
                <th className="px-4 py-3 text-center">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {terms.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No subject offerings enrolled yet. Contact your faculty or registrar for
                    enrollment.
                  </td>
                </tr>
              ) : (
                terms.map((term) => (
                  <Fragment key={term.key}>
                    <tr className="bg-primary/10 text-primary">
                      <td colSpan={10} className="px-4 py-2 italic">
                        {studentEnrollmentTermLabel(term)}
                      </td>
                    </tr>
                    {term.enrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="border-b border-slate-200 last:border-0">
                        <td className="px-4 py-3 text-center">{enrollment.units ?? 0}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {enrollment.subjectCode || "—"}
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-3">
                          {enrollment.subjectTitle || "—"}
                        </td>
                        <td className="px-4 py-3">{enrollment.sectionName || "—"}</td>
                        <td className="px-4 py-3">{enrollment.schedule || "TBA"}</td>
                        <td className="px-4 py-3">{enrollment.room || "TBA"}</td>
                        <td className="px-4 py-3">{enrollment.facultyName || "TBA"}</td>
                        <td className="px-4 py-3 text-center text-red-500">Unavailable</td>
                        <td className="px-4 py-3 text-center">--</td>
                        <td className="px-4 py-3 text-center font-semibold text-emerald-500">
                          {enrollment.status === "completed" ? "Completed" : "Confirmed"}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={10} className="px-4 py-3 font-semibold text-slate-900">
                        Semestral Total Units: {term.totalUnits}
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Re-enrollment Modal */}
      {showReenrollModal && nextSemesterInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg"
          >
            <h2 className="font-heading text-lg font-bold text-foreground mb-4">
              Re-enrollment Confirmation
            </h2>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Next Semester:</p>
                <p className="text-sm text-muted-foreground">
                  {nextSemesterInfo.yearLevel} - {nextSemesterInfo.semester}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  You will be automatically enrolled in the curriculum subjects for this term.
                </p>
              </div>
              {curriculumSubjects.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Subjects to enroll:
                  </p>
                  <ul className="text-xs space-y-1">
                    {curriculumSubjects.map((s) => (
                      <li key={s.code} className="text-foreground">
                        {s.code} - {s.title} ({s.units} units)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowReenrollModal(false)}
                  className="rounded-lg border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReenroll}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Confirm Re-enrollment
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
