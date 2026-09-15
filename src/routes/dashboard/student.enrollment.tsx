import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEnrollments } from "@/lib/enrollment-store"; // new store that uses offeringId
import { useGrades } from "@/lib/grades-store";
import { fetchSubjectOfferings, fetchCurriculum, reenrollStudent } from "@/lib/api";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard/student/enrollment")({
  component: StudentEnrollment,
});

function StudentEnrollment() {
  const { user } = useAuth();
  const enrollments = useEnrollments(user?.studentId ?? ""); // returns offerings with subject details
  const grades = useGrades();
  const [offerings, setOfferings] = useState<any[]>([]);
  const [showReenrollModal, setShowReenrollModal] = useState(false);
  const [canReenroll, setCanReenroll] = useState(false);
  const [nextSemesterInfo, setNextSemesterInfo] = useState<{
    yearLevel: string;
    semester: string;
  } | null>(null);
  const [curriculumSubjects, setCurriculumSubjects] = useState<
    { code: string; title: string; units: number }[]
  >([]);

  // Get offerings for display
  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const data = await fetchSubjectOfferings();
        setOfferings(data);
      } catch {
        setOfferings([]);
      }
    };
    loadOfferings();
  }, []);

  const totalUnits = enrollments.reduce((sum, e) => sum + (e.units || 0), 0);
  const program = user?.program || "";

  // Check reenrollment eligibility: all enrolled offerings have finalized grades
  useEffect(() => {
    if (!user?.studentId || enrollments.length === 0) {
      setCanReenroll(false);
      return;
    }

    const allGradesSubmitted = enrollments.every((enrollment) => {
      const grade = grades.find(
        (g) => g.studentId === user.studentId && g.subjectOfferingId === enrollment.id,
      );
      return grade && grade.status !== "draft";
    });

    if (allGradesSubmitted && enrollments.length > 0) {
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
    } catch (err: any) {
      import("sonner").then(({ toast }) => {
        toast.error(err?.message || "Failed to submit re-enrollment request.");
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Enrollment</h1>
          <p className="text-sm text-muted-foreground">
            Subject offerings assigned to you for this semester. Re-enrollment available after all grades are
            submitted.
          </p>
        </div>
        {canReenroll && (
          <button
            onClick={() => setShowReenrollModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" /> Apply for Re-enrollment
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Offerings Enrolled</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">
            {enrollments.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Units</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{totalUnits}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="mt-1 font-heading text-2xl font-bold text-success">Active</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" />
          <h2 className="font-heading text-sm font-semibold text-card-foreground">My Subject Offerings</h2>
        </div>

        {enrollments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/50 px-4 py-10 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No subject offerings enrolled yet. Contact your faculty or registrar for enrollment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {enrollments.map((enrollment) => {
              const offering = offerings.find((o) => o.id === enrollment.subjectOfferingId);
              const grade = grades.find(
                (g) => g.studentId === user?.studentId && g.subjectOfferingId === enrollment.subjectOfferingId,
              );
              const hasGrade = !!grade && grade.status !== "draft";
              return (
                <motion.div
                  key={enrollment.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-4 py-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-bold text-foreground">
                        {offering?.subjectCode || "—"}
                      </span>
                      <span className="text-sm text-foreground">{offering?.subjectTitle || "—"}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {offering?.schedule || "TBA"} · {offering?.room || "TBA"} · Instructor: {offering?.facultyName || "TBA"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasGrade && (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="sr-only">Grade Submitted</span>
                      </>
                    )}
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                      {offering?.units || 0} units
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
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