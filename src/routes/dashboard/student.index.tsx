import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { StatCard } from "@/components/StatCard";
import {
  BookOpen,
  Calendar,
  Clock,
  TrendingUp,
  User,
  MapPin,
  ClipboardList,
  BellRing,
  Megaphone,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  fetchAnnouncements,
  fetchAttendanceRecords,
  fetchEnrollments,
  fetchGrades,
  fetchNotifications,
  fetchStudentById,
  fetchSubjectOfferings,
  fetchEligibleReenrollments,
  reenrollStudent,
  type Announcement,
  type GradeEntry,
  type NotificationItem,
  type StudentEnrollment,
  type StudentRegistration,
} from "@/lib/api";
import { YEAR_LEVELS, SEMESTERS } from "@/lib/subjects-store";

function buildGradeBreakdown(periodEntries: GradeEntry[], computedGrade: number | null) {
  const componentDefinitions = [
    { key: "quiz", label: "Quiz" },
    { key: "assignment", label: "Assignment" },
    { key: "activity", label: "Activity" },
    { key: "project", label: "Project" },
    { key: "exam", label: "Exam" },
  ];

  const items = componentDefinitions
    .map(({ key, label }) => {
      const values = periodEntries
        .filter((entry) => entry.type === key || entry.component?.toLowerCase() === key)
        .map((entry) => entry.grade);
      return values.length > 0 ? { label, values } : null;
    })
    .filter((item): item is { label: string; values: number[] } => Boolean(item));

  if (items.length === 0) {
    const fallbackValues = periodEntries.map((entry) => entry.grade);
    if (fallbackValues.length > 0) {
      return { items: [{ label: "Recorded Scores", values: fallbackValues }], computedGrade };
    }
  }

  return { items, computedGrade };
}

export const Route = createFileRoute("/dashboard/student/")({
  component: StudentDashboard,
});

function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studentProfile, setStudentProfile] = useState<StudentRegistration | null>(null);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]); // subjectOfferings with subject details
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligibleForReenrollment, setEligibleForReenrollment] = useState(false);
  const [isReenrolling, setIsReenrolling] = useState(false);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
  const [expandedYearLevels, setExpandedYearLevels] = useState<string[]>([YEAR_LEVELS[0]]);
  const [expandedOfferingIds, setExpandedOfferingIds] = useState<string[]>([]);
  const [hasAttemptedProfileLoad, setHasAttemptedProfileLoad] = useState(false);

  // Map offeringId → full offering object
  const offeringMap = useMemo(() => {
    const map: Record<string, any> = {};
    offerings.forEach((o) => { map[o.id] = o; });
    return map;
  }, [offerings]);

  // Combined enrollments with offering details
  const enrichedEnrollments = useMemo(() => {
    return enrollments.map((e) => ({
      ...e,
      offering: offeringMap[e.subjectOfferingId] || null,
    }));
  }, [enrollments, offeringMap]);

  const refreshDashboard = useCallback(async () => {
    if (!user?.studentId) {
      setStudentProfile(null);
      setEnrollments([]);
      setOfferings([]);
      setGrades([]);
      setAnnouncements([]);
      setNotifications([]);
      setAttendanceRate(null);
      setLoading(false);
      setHasAttemptedProfileLoad(true);
      return;
    }

    try {
      setLoading(true);
      const profile = await fetchStudentById(user.studentId);
      const [enrollmentData, offeringData, gradeData, announcementData, notificationData] =
        await Promise.all([
          fetchEnrollments(user.studentId),
          fetchSubjectOfferings(),
          fetchGrades(undefined, user.studentId),
          fetchAnnouncements(),
          fetchNotifications(user.studentId),
        ]);

      setStudentProfile(profile);
      const persistedEnrollments = enrollmentData.filter((entry) => entry.status !== "dropped");
      setEnrollments(persistedEnrollments);
      setOfferings(offeringData);
      setGrades(gradeData);
      setAnnouncements(
        (announcementData || []).filter(
          (item) => item.audience === "all" || item.audience === "student",
        ),
      );
      setNotifications(notificationData || []);

      try {
        const eligibleData = await fetchEligibleReenrollments();
        setEligibleForReenrollment(eligibleData.some((item) => item.studentId === user.studentId));
      } catch {
        setEligibleForReenrollment(false);
      }
    } catch {
      setStudentProfile(null);
      setEnrollments([]);
      setOfferings([]);
      setGrades([]);
      setAnnouncements([]);
      setNotifications([]);
      setEligibleForReenrollment(false);
    } finally {
      setLoading(false);
      setHasAttemptedProfileLoad(true);
    }
  }, [user?.studentId]);

  useEffect(() => {
    refreshDashboard();
    const refreshEvents = [
      "bwest:registrations-changed",
      "bwest:enrollments-changed",
      "bwest:grades-changed",
      "bwest:announcements-changed",
      "bwest:attendance-changed",
    ];
    const onChange = () => {
      void refreshDashboard();
    };
    refreshEvents.forEach((eventName) => window.addEventListener(eventName, onChange));
    return () => {
      refreshEvents.forEach((eventName) => window.removeEventListener(eventName, onChange));
    };
  }, [refreshDashboard]);

  useEffect(() => {
    if (!loading && user?.role === "student" && studentProfile?.status === "not_started") {
      navigate({ to: "/register" });
    }
  }, [loading, studentProfile?.status, navigate, user?.role]);

  // Attendance rate: based on all offerings the student is enrolled in
  useEffect(() => {
    const loadAttendance = async () => {
      if (!user?.studentId || enrollments.length === 0) {
        setAttendanceRate(null);
        return;
      }
      try {
        const offeringIds = enrollments.map((e) => e.subjectOfferingId);
        const records = await Promise.all(
          offeringIds.map((id) => fetchAttendanceRecords({ offeringId: id, studentId: user.studentId })),
        );
        const allRecords = records.flat();
        const present = allRecords.filter(
          (record) => record.status === "present" || record.status === "late",
        ).length;
        const total = allRecords.length;
        setAttendanceRate(total > 0 ? Math.round((present / total) * 100) : null);
      } catch {
        setAttendanceRate(null);
      }
    };
    void loadAttendance();
  }, [user?.studentId, enrollments]);

  useEffect(() => {
    const handleAttendanceChange = () => {
      if (user?.studentId && enrollments.length > 0) {
        const offeringIds = enrollments.map((e) => e.subjectOfferingId);
        Promise.all(
          offeringIds.map((id) => fetchAttendanceRecords({ offeringId: id, studentId: user.studentId })),
        )
          .then((records) => {
            const allRecords = records.flat();
            const present = allRecords.filter(
              (record) => record.status === "present" || record.status === "late",
            ).length;
            const total = allRecords.length;
            setAttendanceRate(total > 0 ? Math.round((present / total) * 100) : null);
          })
          .catch(() => setAttendanceRate(null));
      } else {
        setAttendanceRate(null);
      }
    };
    window.addEventListener("bwest:attendance-changed", handleAttendanceChange);
    return () => window.removeEventListener("bwest:attendance-changed", handleAttendanceChange);
  }, [user?.studentId, enrollments]);

  const currentEnrollmentContext = enrichedEnrollments[0]?.offering;
  const currentAcademicYear =
    studentProfile?.academicYear || currentEnrollmentContext?.academicYearCode || "";
  const currentSemester =
    studentProfile?.semester || currentEnrollmentContext?.semesterName || "";
  const displayName = studentProfile
    ? `${studentProfile.firstName} ${studentProfile.lastName}`.trim()
    : (user?.name ?? "Student");
  const displayAcademicYear = currentAcademicYear || user?.academicYear || "—";
  const displaySemester = currentSemester || user?.semester || "—";
  const registrationStatus =
    studentProfile?.status === "approved"
      ? "Approved"
      : studentProfile?.status === "rejected"
        ? "Rejected"
        : studentProfile?.status === "submitted" || studentProfile?.status === "under_review"
          ? "Under Review"
          : "Registration Not Started";
  const enrollmentStatus = enrollments.length > 0 ? "Enrolled" : "Not Enrolled";
  const displayProgram =
    studentProfile?.program || currentEnrollmentContext?.programName || user?.program || "—";
  const displayYearLevel =
    studentProfile?.yearLevel || currentEnrollmentContext?.yearLevel || user?.yearLevel || "—";
  const displaySection =
    studentProfile?.section || currentEnrollmentContext?.sectionName || "—";
  const displayAddress = [
    studentProfile?.address,
    studentProfile?.barangay,
    studentProfile?.city,
    studentProfile?.province,
    studentProfile?.region,
    studentProfile?.zip,
  ].filter(Boolean).join(", ") || "—";

  // Build subject summaries from offerings and grades
  const subjectSummaries = useMemo(() => {
    return enrichedEnrollments.map((enrollment) => {
      const offering = enrollment.offering;
      if (!offering) return null;
      const offeringGrades = grades.filter((grade) => grade.subjectOfferingId === enrollment.subjectOfferingId);
      const prelimEntries = offeringGrades.filter((grade) => grade.period === "prelim");
      const midtermEntries = offeringGrades.filter((grade) => grade.period === "midterm");
      const finalEntries = offeringGrades.filter((grade) => grade.period === "final");
      const overallEntries = offeringGrades.filter((grade) => grade.type === "overall");
      const computeGrade = (entries: GradeEntry[]) => {
        if (entries.length === 0) return null;
        const gradeEntry =
          entries.find((entry) => entry.status === "finalized" || entry.type === "overall") ??
          entries[0];
        if (gradeEntry && gradeEntry.type === "overall") return gradeEntry.grade;
        const average = entries.reduce((sum, entry) => sum + entry.grade, 0) / entries.length;
        return Number(average.toFixed(2));
      };
      const prelimGrade = computeGrade(prelimEntries);
      const midtermGrade = computeGrade(midtermEntries);
      const finalGrade = computeGrade(finalEntries.length > 0 ? finalEntries : overallEntries);
      const overallGrade = finalGrade ?? computeGrade(overallEntries) ?? null;
      const remark =
        overallGrade === null
          ? "Pending"
          : overallGrade >= 75
            ? "Passed"
            : overallGrade >= 60
              ? "Incomplete"
              : "Failed";
      return {
        offering,
        enrollment,
        prelimGrade,
        midtermGrade,
        finalGrade,
        overallGrade,
        remark,
        offeringGrades,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [enrichedEnrollments, grades]);

  useEffect(() => {
    if (!selectedOfferingId && subjectSummaries.length > 0) {
      setSelectedOfferingId(subjectSummaries[0].offering.id);
    }
  }, [selectedOfferingId, subjectSummaries]);

  const selectedSubjectSummary = useMemo(() => {
    return (
      subjectSummaries.find((summary) => summary.offering.id === selectedOfferingId) ??
      subjectSummaries[0] ??
      null
    );
  }, [selectedOfferingId, subjectSummaries]);

  const currentTermEnrollments = useMemo(() => {
    return enrichedEnrollments.filter(
      (entry) =>
        (!currentAcademicYear || entry.offering?.academicYearCode === currentAcademicYear) &&
        (!currentSemester || entry.offering?.semesterName === currentSemester),
    );
  }, [enrichedEnrollments, currentAcademicYear, currentSemester]);

  const historicalEnrollments = useMemo(() => {
    return enrichedEnrollments.filter(
      (entry) =>
        entry.status === "completed" &&
        !(entry.offering?.academicYearCode === currentAcademicYear &&
          entry.offering?.semesterName === currentSemester),
    );
  }, [enrichedEnrollments, currentAcademicYear, currentSemester]);

  const historyEntries = useMemo(() => {
    return historicalEnrollments
      .map((entry) => {
        const offering = entry.offering;
        if (!offering) return null;
        const offeringGrades = grades.filter(
          (grade) =>
            grade.studentId === user?.studentId &&
            grade.subjectOfferingId === entry.subjectOfferingId,
        );
        const overallEntries = offeringGrades.filter((grade) => grade.type === "overall");
        const finalEntries = offeringGrades.filter((grade) => grade.period === "final");
        const computedFinalGrade =
          finalEntries.length > 0
            ? (finalEntries.find((grade) => grade.status === "finalized")?.grade ??
              finalEntries[0].grade)
            : overallEntries.length > 0
              ? (overallEntries.find((grade) => grade.status === "finalized")?.grade ??
                overallEntries[0].grade)
              : null;
        return {
          ...entry,
          offering,
          offeringGrades,
          finalGrade: computedFinalGrade,
          gradeStatus:
            computedFinalGrade === null
              ? "Pending"
              : computedFinalGrade >= 75
                ? "Passed"
                : computedFinalGrade >= 60
                  ? "Incomplete"
                  : "Failed",
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [historicalEnrollments, grades, user?.studentId]);

  const historyByYear = useMemo(() => {
    const yearOrder = YEAR_LEVELS;
    const semesterOrder = SEMESTERS;

    return yearOrder
      .map((yearLevel) => {
        const yearEntries = historyEntries.filter(
          (entry) => entry.offering?.yearLevel === yearLevel,
        );
        const semesterMap = new Map<string, typeof historyEntries>();
        yearEntries.forEach((entry) => {
          const semester = entry.offering?.semesterName || entry.semester || "—";
          const groupedEntries = semesterMap.get(semester) ?? [];
          groupedEntries.push(entry);
          semesterMap.set(semester, groupedEntries);
        });

        const semesters = Array.from(semesterMap.entries())
          .sort(([left], [right]) => semesterOrder.indexOf(left) - semesterOrder.indexOf(right))
          .map(([semester, entries]) => ({
            semester,
            academicYear: entries[0]?.offering?.academicYearCode || currentAcademicYear,
            entries,
            totalUnits: entries.reduce((sum, historyEntry) => sum + (historyEntry.offering?.units || 0), 0),
            averageGrade: entries.some((historyEntry) => historyEntry.finalGrade !== null)
              ? (() => {
                  const graded = entries.filter((historyEntry) => historyEntry.finalGrade !== null);
                  const totalUnits = graded.reduce(
                    (sum, historyEntry) => sum + (historyEntry.offering?.units || 0),
                    0,
                  );
                  if (totalUnits === 0) return null;
                  return Number(
                    (
                      graded.reduce(
                        (sum, historyEntry) =>
                          sum + (historyEntry.finalGrade ?? 0) * (historyEntry.offering?.units || 0),
                        0,
                      ) / totalUnits
                    ).toFixed(2),
                  );
                })()
              : null,
          }));

        return { yearLevel, semesters };
      })
      .filter((group) => group.semesters.length > 0);
  }, [historyEntries, currentAcademicYear]);

  const totalUnitsEnrolled = currentTermEnrollments.reduce((sum, entry) => {
    return sum + (entry.offering?.units || 0);
  }, 0);
  const totalUnitsEarned = historyEntries.reduce((sum, entry) => sum + (entry.offering?.units || 0), 0);
  const completedSubjects = historyEntries.length;
  const subjectCount = currentTermEnrollments.length;
  const gradedSubjects = historyEntries.filter((entry) => entry.finalGrade !== null).length;
  const overallGwa =
    historyEntries.filter((entry) => entry.finalGrade !== null).length > 0
      ? (() => {
          const graded = historyEntries.filter((entry) => entry.finalGrade !== null);
          const totalUnits = graded.reduce((sum, entry) => sum + (entry.offering?.units || 0), 0);
          if (totalUnits === 0) return null;
          return Number(
            (
              graded.reduce(
                (sum, entry) => sum + (entry.finalGrade ?? 0) * (entry.offering?.units || 0),
                0,
              ) / totalUnits
            ).toFixed(2),
          );
        })()
      : null;
  const academicStatus =
    currentTermEnrollments.length === 0 &&
    historyEntries.length > 0 &&
    studentProfile?.yearLevel === YEAR_LEVELS[3]
      ? "Graduated"
      : currentTermEnrollments.length > 0 && gradedSubjects < currentTermEnrollments.length
        ? "Irregular"
        : "Regular";
  const showCompletionSection =
    academicStatus === "Graduated" ||
    (currentTermEnrollments.length === 0 &&
      historyEntries.length > 0 &&
      studentProfile?.yearLevel === YEAR_LEVELS[3]);

  const toggleYearLevel = (yearLevel: string) => {
    setExpandedYearLevels((current) =>
      current.includes(yearLevel)
        ? current.filter((entry) => entry !== yearLevel)
        : [...current, yearLevel],
    );
  };

  const toggleSubject = (offeringId: string) => {
    setExpandedOfferingIds((current) =>
      current.includes(offeringId)
        ? current.filter((entry) => entry !== offeringId)
        : [...current, offeringId],
    );
  };

  const handleReenrollment = async () => {
    if (!user?.studentId || !eligibleForReenrollment) return;
    setIsReenrolling(true);
    try {
      const result = await reenrollStudent(user.studentId, {
        nextAcademicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      });
      if (result?.student) {
        setStudentProfile(result.student);
      }
      setEligibleForReenrollment(false);
      // Refresh enrollments after reenrollment
      const newEnrollments = await fetchEnrollments(user.studentId);
      setEnrollments(newEnrollments.filter((e) => e.status !== "dropped"));
      window.dispatchEvent(new Event("bwest:enrollments-changed"));
    } catch {
      // keep the error hidden from the student while preserving a clean experience
    } finally {
      setIsReenrolling(false);
    }
  };

  if (user?.role === "student") {
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
            <h1 className="font-heading text-xl font-bold text-foreground">
              Loading your student portal
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Preparing your dashboard and registration status.
            </p>
          </div>
        </div>
      );
    }

    if (!studentProfile && hasAttemptedProfileLoad) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
            <h1 className="font-heading text-xl font-bold text-foreground">
              Unable to load your profile
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We could not verify your registration status. Please log out and sign in again.
            </p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }

    if (studentProfile?.status !== "approved") {
      if (studentProfile?.status === "submitted" || studentProfile?.status === "under_review") {
        return (
          <div className="flex min-h-screen items-center justify-center">
            <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
              <h1 className="font-heading text-xl font-bold text-foreground">
                Registration Under Review
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your registration is under review by the Registrar. Please wait for approval.
              </p>
            </div>
          </div>
        );
      }

      if (studentProfile?.status === "rejected") {
        return (
          <div className="flex min-h-screen items-center justify-center">
            <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
              <h1 className="font-heading text-xl font-bold text-foreground">
                Registration Needs Revision
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {studentProfile?.reviewNote ||
                  "Your registration was returned for revision. Please update the form and resubmit it."}
              </p>
              <button
                onClick={() => navigate({ to: "/register" })}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Edit Registration
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
            <h1 className="font-heading text-xl font-bold text-foreground">
              Unable to determine registration status
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account is in an unexpected state. Please log out and sign in again or contact
              the registrar.
            </p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground">Student Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Academic year {displayAcademicYear}, {displaySemester}
            </p>
          </div>
          <div className="rounded-full bg-muted/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {registrationStatus}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Student ID</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">
              {studentProfile?.studentId || user?.studentId || user?.id || "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Full Name</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{displayName}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Email Address</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {studentProfile?.email || user?.email || "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Program</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {displayProgram}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Year Level</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {displayYearLevel}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Semester</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {displaySemester}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Academic Year</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{displayAcademicYear}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Enrollment Status</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{enrollmentStatus}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-accent" />
              <h3 className="font-heading text-xs font-semibold uppercase text-muted-foreground">
                Student Details
              </h3>
            </div>
            <div className="space-y-1 text-sm text-foreground">
              <p>
                <span className="text-muted-foreground">Email:</span>{" "}
                {studentProfile?.email || user?.email || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Contact:</span>{" "}
                {studentProfile?.contactNumber || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Gender:</span>{" "}
                {studentProfile?.gender || "—"}
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-accent" />
              <h3 className="font-heading text-xs font-semibold uppercase text-muted-foreground">
                Address
              </h3>
            </div>
            <p className="text-sm text-foreground">{displayAddress}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Current Program",
            value: displayProgram,
            subtitle: "Verified from student record",
            icon: BookOpen,
          },
          {
            title: "Current Year Level",
            value: displayYearLevel,
            subtitle: "Updated by registrar",
            icon: Calendar,
          },
          {
            title: "Current Semester",
            value: displaySemester,
            subtitle: "Current academic term",
            icon: Clock,
          },
          {
            title: "Total Enrolled Subject Offerings",
            value: subjectCount,
            subtitle: `${totalUnitsEnrolled} total units`,
            icon: ClipboardList,
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-accent" />
          <h2 className="font-heading text-sm font-semibold text-card-foreground">
            Academic Summary
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Current Year Level</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {displayYearLevel}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Current Semester</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{displaySemester}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Program / Course</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {displayProgram}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Section</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {displaySection}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Total Units Earned</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{totalUnitsEarned}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Total Units Enrolled</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{totalUnitsEnrolled}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Overall GWA</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{overallGwa ?? "—"}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Academic Status</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{academicStatus}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" />
          <h2 className="font-heading text-sm font-semibold text-card-foreground">
            Current Semester
          </h2>
        </div>
        {currentTermEnrollments.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            No current semester enrollment is available yet.
          </p>
        ) : (
          <div className="space-y-3">
            {currentTermEnrollments.map((entry) => {
              const offering = entry.offering;
              const offeringGrades = grades.filter(
                (grade) =>
                  grade.studentId === user?.studentId && grade.subjectOfferingId === entry.subjectOfferingId,
              );
              const finalizedGrade =
                offeringGrades.find((grade) => grade.status === "finalized")?.grade ??
                offeringGrades.find((grade) => grade.period === "final")?.grade ??
                null;
              return (
                <div key={entry.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-sm font-semibold text-foreground">
                        {offering?.subjectCode || "Subject"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {offering?.subjectTitle || "Subject title unavailable"}
                      </p>
                    </div>
                    <div className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                      {offering?.units ?? 0} units
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <p>
                      <span className="font-medium text-foreground">Assigned Faculty:</span>{" "}
                      {offering?.facultyName || "Faculty assignment pending"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Schedule:</span>{" "}
                      {offering?.schedule || "TBA"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Room:</span>{" "}
                      {offering?.room || "TBA"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Current Grade Status:</span>{" "}
                      {finalizedGrade === null ? "Pending" : `${finalizedGrade}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" />
          <h2 className="font-heading text-sm font-semibold text-card-foreground">
            Academic History
          </h2>
        </div>
        {historyByYear.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            No historical academic records are available yet.
          </p>
        ) : (
          <div className="space-y-3">
            {historyByYear.map((yearGroup) => {
              const isExpanded = expandedYearLevels.includes(yearGroup.yearLevel);
              return (
                <div key={yearGroup.yearLevel} className="rounded-lg border bg-muted/20 p-4">
                  <button
                    type="button"
                    onClick={() => toggleYearLevel(yearGroup.yearLevel)}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="font-heading text-sm font-semibold text-foreground">
                        {yearGroup.yearLevel}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {yearGroup.semesters.length} completed semester
                        {yearGroup.semesters.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="mt-4 space-y-3">
                      {yearGroup.semesters.map((semesterGroup) => (
                        <div
                          key={`${yearGroup.yearLevel}-${semesterGroup.semester}`}
                          className="rounded-lg border bg-background/70 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-heading text-sm font-semibold text-foreground">
                                {yearGroup.yearLevel} - {semesterGroup.semester}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Academic year {semesterGroup.academicYear}
                              </p>
                            </div>
                            <div className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                              {semesterGroup.totalUnits} units
                            </div>
                          </div>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                  <th className="pb-2 pr-4">Subject</th>
                                  <th className="pb-2 pr-4">Units</th>
                                  <th className="pb-2 pr-4">Faculty</th>
                                  <th className="pb-2 pr-4">Year Level</th>
                                  <th className="pb-2 pr-4">Semester</th>
                                  <th className="pb-2 pr-4">Academic Year</th>
                                  <th className="pb-2 pr-4">Final Grade</th>
                                  <th className="pb-2">Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {semesterGroup.entries.map((entry) => {
                                  const isExpandedSubject = expandedOfferingIds.includes(
                                    entry.offering.id,
                                  );
                                  return (
                                    <React.Fragment key={entry.id}>
                                      <tr className="border-b border-muted/50 last:border-0">
                                        <td className="py-3 pr-4">
                                          <button
                                            type="button"
                                            onClick={() => toggleSubject(entry.offering.id)}
                                            className="flex items-center gap-2 text-left font-medium text-foreground"
                                          >
                                            <span>{entry.offering.subjectCode}</span>
                                            {isExpandedSubject ? (
                                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                            ) : (
                                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                            )}
                                          </button>
                                          <p className="text-xs text-muted-foreground">
                                            {entry.offering.subjectTitle}
                                          </p>
                                        </td>
                                        <td className="py-3 pr-4 text-muted-foreground">
                                          {entry.offering.units ?? 0}
                                        </td>
                                        <td className="py-3 pr-4 text-muted-foreground">
                                          {entry.offering.facultyName || "—"}
                                        </td>
                                        <td className="py-3 pr-4 text-muted-foreground">
                                          {entry.offering.yearLevel || "—"}
                                        </td>
                                        <td className="py-3 pr-4 text-muted-foreground">
                                          {entry.offering.semesterName || entry.semester || "—"}
                                        </td>
                                        <td className="py-3 pr-4 text-muted-foreground">
                                          {entry.offering.academicYearCode || entry.academicYear || "—"}
                                        </td>
                                        <td className="py-3 pr-4 text-muted-foreground">
                                          {entry.finalGrade ?? "—"}
                                        </td>
                                        <td className="py-3 text-muted-foreground">
                                          {entry.gradeStatus}
                                        </td>
                                      </tr>
                                      {isExpandedSubject && (
                                        <tr>
                                          <td colSpan={8} className="pb-3">
                                            <div className="rounded-lg border bg-muted/30 p-3">
                                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                Grade Breakdown
                                              </p>
                                              <div className="mt-3 grid gap-3 md:grid-cols-3">
                                                {(["prelim", "midterm", "final"] as const).map(
                                                  (period) => {
                                                    const periodGrades = entry.offeringGrades.filter(
                                                      (grade) => grade.period === period,
                                                    );
                                                    const computed =
                                                      period === "prelim"
                                                        ? null
                                                        : period === "midterm"
                                                          ? null
                                                          : entry.finalGrade;
                                                    const { items } = buildGradeBreakdown(
                                                      periodGrades,
                                                      computed,
                                                    );
                                                    const label =
                                                      period === "prelim"
                                                        ? "Prelim Grade"
                                                        : period === "midterm"
                                                          ? "Midterm Grade"
                                                          : "Final Grade";
                                                    return (
                                                      <div
                                                        key={`${entry.offering.id}-${period}`}
                                                        className="rounded-lg border bg-background/70 p-3"
                                                      >
                                                        <p className="text-sm font-semibold capitalize text-foreground">
                                                          {period}
                                                        </p>
                                                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                                          {items.map((item) => (
                                                            <p
                                                              key={`${entry.offering.id}-${period}-${item.label}`}
                                                            >
                                                              <span className="font-medium text-foreground">
                                                                {item.label}:
                                                              </span>{" "}
                                                              {item.values.join(", ")}
                                                            </p>
                                                          ))}
                                                          <p>
                                                            <span className="font-medium text-foreground">
                                                              {label}:
                                                            </span>{" "}
                                                            {computed ?? "—"}
                                                          </p>
                                                        </div>
                                                      </div>
                                                    );
                                                  },
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCompletionSection && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-accent" />
            <h2 className="font-heading text-sm font-semibold text-card-foreground">
              Academic Completion
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Total Units Completed</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{totalUnitsEarned}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Overall GWA</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{overallGwa ?? "—"}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Graduation Status</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{academicStatus}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Registration Approved</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {studentProfile?.reviewedAt
                  ? new Date(studentProfile.reviewedAt).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent" />
            <h2 className="font-heading text-sm font-semibold text-card-foreground">My Subject Offerings</h2>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading your enrolled offerings...</p>
          ) : enrichedEnrollments.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              No subject offerings have been assigned to your enrollment yet.
            </p>
          ) : (
            <div className="space-y-3">
              {enrichedEnrollments.map((enrollment) => {
                const offering = enrollment.offering;
                if (!offering) return null;
                return (
                  <div key={enrollment.id} className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-heading text-sm font-semibold text-foreground">
                          {offering.subjectCode}
                        </p>
                        <p className="text-sm text-foreground">{offering.subjectTitle}</p>
                      </div>
                      <div className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                        {offering.units} units
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <p>
                        <span className="font-medium text-foreground">Schedule:</span>{" "}
                        {offering.schedule || "TBA"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Room:</span>{" "}
                        {offering.room || "TBA"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Assigned Faculty:</span>{" "}
                        {offering.facultyName || "Faculty assignment pending."}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Semester:</span>{" "}
                        {offering.semesterName || displaySemester}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent" />
            <h2 className="font-heading text-sm font-semibold text-card-foreground">
              Class Schedule
            </h2>
          </div>
          {enrichedEnrollments.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              No class schedule is available yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Subject</th>
                    <th className="pb-2 pr-4">Day/Time</th>
                    <th className="pb-2 pr-4">Room</th>
                    <th className="pb-2">Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedEnrollments.map((enrollment) => {
                    const offering = enrollment.offering;
                    if (!offering) return null;
                    return (
                      <tr key={enrollment.id} className="border-b border-muted/50 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-heading font-semibold text-foreground">{offering.subjectCode}</p>
                          <p className="text-xs text-muted-foreground">{offering.subjectTitle}</p>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {offering.schedule || "TBA"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{offering.room || "TBA"}</td>
                        <td className="py-3 text-muted-foreground">
                          {offering.facultyName || "Faculty assignment pending."}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-accent" />
          <h2 className="font-heading text-sm font-semibold text-card-foreground">Grades</h2>
        </div>
        {subjectSummaries.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            No grades have been posted for your enrolled subjects yet.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Subject</th>
                    <th className="pb-2 pr-4">Prelim</th>
                    <th className="pb-2 pr-4">Midterm</th>
                    <th className="pb-2 pr-4">Final</th>
                    <th className="pb-2 pr-4">Overall</th>
                    <th className="pb-2">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectSummaries.map((summary) => (
                    <tr key={summary.offering.id} className="border-b border-muted/50 last:border-0">
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left font-medium text-foreground"
                          onClick={() => setSelectedOfferingId(summary.offering.id)}
                        >
                          <span>{summary.offering.subjectCode}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <p className="text-xs text-muted-foreground">{summary.offering.subjectTitle}</p>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {summary.prelimGrade ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {summary.midtermGrade ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {summary.finalGrade ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {summary.overallGrade ?? "—"}
                      </td>
                      <td className="py-3 text-muted-foreground">{summary.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedSubjectSummary && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <h3 className="font-heading text-sm font-semibold text-foreground">
                  Grade Breakdown for {selectedSubjectSummary.offering.subjectCode}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedSubjectSummary.offering.subjectTitle}
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  {(["prelim", "midterm", "final"] as const).map((period) => {
                    const entries = selectedSubjectSummary.offeringGrades.filter(
                      (grade) => grade.period === period,
                    );
                    const computed =
                      period === "prelim"
                        ? selectedSubjectSummary.prelimGrade
                        : period === "midterm"
                          ? selectedSubjectSummary.midtermGrade
                          : selectedSubjectSummary.finalGrade;
                    const { items } = buildGradeBreakdown(entries, computed);
                    const label =
                      period === "prelim"
                        ? "Prelim Grade"
                        : period === "midterm"
                          ? "Midterm Grade"
                          : "Final Grade";
                    return (
                      <div key={period} className="rounded-lg border bg-background/70 p-4">
                        <p className="text-sm font-semibold capitalize text-foreground">{period}</p>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          {items.map((item) => (
                            <p key={`${period}-${item.label}`}>
                              <span className="font-medium text-foreground">{item.label}:</span>{" "}
                              {item.values.join(", ")}
                            </p>
                          ))}
                          <p>
                            <span className="font-medium text-foreground">{label}:</span>{" "}
                            {computed ?? "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h2 className="font-heading text-sm font-semibold text-card-foreground">
            Academic Records
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Academic Year</th>
                <th className="pb-2 pr-4">Semester</th>
                <th className="pb-2 pr-4">Subjects Taken</th>
                <th className="pb-2 pr-4">Units Earned</th>
                <th className="pb-2">Final Grades</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.filter((entry) => entry.status === "completed").length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                    No completed semesters have been finalized yet.
                  </td>
                </tr>
              ) : (
                enrollments
                  .filter((entry) => entry.status === "completed")
                  .map((entry) => {
                    const offering = offeringMap[entry.subjectOfferingId];
                    return (
                      <tr key={entry.id} className="border-b border-muted/50 last:border-0">
                        <td className="py-3 pr-4 text-foreground">
                          {offering?.academicYearCode || entry.academicYear || "—"}
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {offering?.semesterName || entry.semester || "—"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {offering?.subjectTitle || "—"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {offering?.units || 0}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {grades.find(
                            (grade) =>
                              grade.studentId === user?.studentId &&
                              grade.subjectOfferingId === entry.subjectOfferingId,
                          )?.grade ?? "—"}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-accent" />
            <h2 className="font-heading text-sm font-semibold text-card-foreground">
              Registration & Enrollment
            </h2>
          </div>
          <div className="space-y-3 text-sm text-foreground">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Registration Status
              </p>
              <p className="mt-1 font-medium">{registrationStatus}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Enrollment Status
              </p>
              <p className="mt-1 font-medium">{enrollmentStatus}</p>
            </div>
            {eligibleForReenrollment ? (
              <button
                type="button"
                onClick={handleReenrollment}
                disabled={isReenrolling}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" />{" "}
                {isReenrolling ? "Processing..." : "Continue to Next Semester"}
              </button>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                Re-enrollment is currently unavailable. Your grades and academic record must be
                finalized before the next semester can be opened.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-accent" />
            <h2 className="font-heading text-sm font-semibold text-card-foreground">
              Notifications
            </h2>
          </div>
          {notifications.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              No notifications are available right now.
            </p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 6).map((notification) => (
                <div key={notification.id} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-accent" />
          <h2 className="font-heading text-sm font-semibold text-card-foreground">Announcements</h2>
        </div>
        {announcements.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            No announcements have been posted yet.
          </p>
        ) : (
          <div className="space-y-3">
            {announcements
              .slice()
              .sort((left, right) => right.createdAt - left.createdAt)
              .map((announcement) => (
                <div key={announcement.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-sm font-semibold text-foreground">
                        {announcement.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{announcement.body}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {announcement.datePosted ||
                        new Date(announcement.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}