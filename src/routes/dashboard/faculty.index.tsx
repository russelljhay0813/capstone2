import { createFileRoute, Link } from "@tanstack/react-router";
import { StatCard } from "@/components/StatCard";
import { BookOpen, Users, CheckCircle, Calendar, BarChart3, Megaphone, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useMemo, useEffect, useState, useCallback } from "react";
import {
  fetchSubjectOfferings,
  type SubjectOffering,
  fetchEnrollments,
  fetchGrades,
  fetchAttendanceRecords,
  fetchNotifications,
  type NotificationItem,
  fetchAnnouncements,
} from "@/lib/api";
import { SEMESTERS } from "@/lib/subjects-store";

export const Route = createFileRoute("/dashboard/faculty/")({
  component: FacultyDashboard,
});

type RecentGrade = {
  studentId: string;
  studentName: string;
  subjectCode: string;
  subjectTitle: string;
  grade: number;
  period?: string;
  createdAt: number;
};

type RecentAttendance = {
  studentId: string;
  studentName: string;
  subjectCode: string;
  date: string;
  status: string;
  createdAt: number;
};

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: number;
};

function FacultyDashboard() {
  const { user } = useAuth();
  const [facultyOfferings, setFacultyOfferings] = useState<SubjectOffering[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [recentGrades, setRecentGrades] = useState<RecentGrade[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<AnnouncementItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [todayAttendanceCount, setTodayAttendanceCount] = useState(0);
  const [pendingGradesCount, setPendingGradesCount] = useState(0);
  const [completedGradesCount, setCompletedGradesCount] = useState(0);
  const [currentSemester, setCurrentSemester] = useState("—");
  const [currentAcademicYear, setCurrentAcademicYear] = useState("—");

  const today = new Date().toISOString().slice(0, 10);
  const aliases = useMemo(() => {
    const todayToken = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date().getDay()];
    const todayAliases: Record<string, string[]> = {
      MON: ["M", "MW", "MWF", "MTH", "MON", "MONDAY"],
      TUE: ["T", "TTH", "TF", "TUE", "TUESDAY"],
      WED: ["W", "MW", "MWF", "WF", "WED", "WEDNESDAY"],
      THU: ["TH", "TTH", "MTH", "THU", "THURSDAY"],
      FRI: ["F", "MWF", "TF", "WF", "FRI", "FRIDAY"],
      SAT: ["S", "SAT", "SATURDAY"],
      SUN: ["SUN", "SUNDAY"],
    };
    return todayAliases[todayToken] ?? [];
  }, []);

  const loadFacultyData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [facultyOfferingsData, allEnrollments, allGrades, notificationData, announcementData] =
        await Promise.all([
          fetchSubjectOfferings({ facultyId: user.facultyId || user.id }),
          fetchEnrollments(),
          fetchGrades(),
          fetchNotifications(user.id),
          fetchAnnouncements(),
        ]);
      const facultyOnly = facultyOfferingsData;
      const offeringIds = facultyOnly.map((o) => o.id);
      setFacultyOfferings(facultyOnly);
      setEnrollments(allEnrollments);
      setRecentGrades(
        allGrades
          .filter((g) => offeringIds.includes(g.subjectOfferingId))
          .sort((a, b) => b.submittedAt - a.submittedAt)
          .slice(0, 5)
          .map((g) => ({
            studentId: g.studentId,
            studentName: g.studentName || `${g.studentFirstName ?? ""} ${g.studentLastName ?? ""}`.trim() || g.studentId,
            subjectCode: g.subjectCode || "",
            subjectTitle: g.subjectTitle || "",
            grade: g.grade,
            period: g.period,
            createdAt: g.submittedAt,
          })),
      );
      setPendingGradesCount(
        allGrades.filter((g) => offeringIds.includes(g.subjectOfferingId) && g.status === "draft")
          .length,
      );
      setCompletedGradesCount(
        allGrades.filter(
          (g) =>
            offeringIds.includes(g.subjectOfferingId) &&
            (g.status === "submitted" || g.status === "finalized"),
        ).length,
      );
      const now = new Date();
      const currentMonth = now.getMonth();
      const computedSemester = currentMonth >= 6 ? SEMESTERS[0] : SEMESTERS[1];
      setCurrentSemester(user.semester || facultyOnly[0]?.semesterName || computedSemester);
      setCurrentAcademicYear(user.academicYear || facultyOnly[0]?.academicYearCode || "—");
      setNotifications(notificationData.slice(0, 5));
      setRecentAnnouncements(
        announcementData
          .filter((a) => a.audience === "faculty" || a.audience === "all")
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
          .slice(0, 3)
          .map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            authorName: a.authorName || "PIAT",
            createdAt: a.createdAt ?? Date.now(),
          })),
      );
    } catch {
      setFacultyOfferings([]);
      setEnrollments([]);
      setRecentGrades([]);
      setPendingGradesCount(0);
      setCompletedGradesCount(0);
      setCurrentSemester("—");
      setCurrentAcademicYear("—");
      setNotifications([]);
      setRecentAnnouncements([]);
    }
  }, [user?.id, user?.semester, user?.academicYear]);

  useEffect(() => {
    loadFacultyData();
  }, [loadFacultyData]);

  const todayClasses = useMemo(
    () =>
      facultyOfferings.filter((o) => {
        const upper = (o.schedule ?? "").toUpperCase();
        return aliases.some((a) => upper.includes(a));
      }),
    [facultyOfferings, aliases],
  );

  const totalStudents = useMemo(() => {
    const offeringIds = facultyOfferings.map((o) => o.id);
    return enrollments.filter((e) => offeringIds.includes(e.subjectOfferingId)).length;
  }, [facultyOfferings, enrollments]);

  useEffect(() => {
    const loadTodayAttendance = async () => {
      try {
        const offeringIds = facultyOfferings.map((o) => o.id);
        const promises = offeringIds.map((oid) => fetchAttendanceRecords({ offeringId: oid, date: today }));
        const results = await Promise.all(promises);
        const allRecords = results.flat();
        setTodayAttendanceCount(allRecords.length);
        setRecentAttendance(
          allRecords
            .map((r) => ({
              studentId: r.studentId,
              studentName: r.studentId,
              subjectCode: "",
              date: r.date,
              status: r.status,
              createdAt: r.updatedAt,
            }))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5),
        );
      } catch {
        setTodayAttendanceCount(0);
        setRecentAttendance([]);
      }
    };
    if (facultyOfferings.length > 0) loadTodayAttendance();
  }, [facultyOfferings, today]);

  const getGradeStatus = (grade: number) => {
    if (grade <= 1.25) return { label: "Excellent", color: "text-green-600" };
    if (grade <= 1.75) return { label: "Very Good", color: "text-blue-600" };
    if (grade <= 2.25) return { label: "Good", color: "text-cyan-600" };
    if (grade <= 3.0) return { label: "Passed", color: "text-yellow-600" };
    return { label: "Failed", color: "text-red-600" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Faculty Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage your classes and academic responsibilities - Staff ID: {" "}
          <span className="font-mono text-foreground">{user?.userId || "—"}</span>
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Total Assigned Subjects",
            value: String(facultyOfferings.length),
            subtitle: "Registrar-assigned classes",
            icon: BookOpen,
          },
          {
            title: "Total Enrolled Students",
            value: String(totalStudents),
            subtitle: "Across all assigned subjects",
            icon: Users,
          },
          {
            title: "Subjects with Pending Grades",
            value: String(pendingGradesCount),
            subtitle: "Draft grade entries",
            icon: Clock,
          },
          {
            title: "Subjects with Completed Grades",
            value: String(completedGradesCount),
            subtitle: "Submitted or finalized",
            icon: CheckCircle,
          },
          {
            title: "Current Semester",
            value: currentSemester,
            subtitle: "Academic term",
            icon: Calendar,
          },
          {
            title: "Current Academic Year",
            value: currentAcademicYear,
            subtitle: "Institution year",
            icon: BarChart3,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
            Pending Grade Submissions
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-foreground">{pendingGradesCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Draft grades requiring finalization
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-muted/50 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
            Today's Schedule
          </h2>
          {todayClasses.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              No classes scheduled for today.
            </p>
          ) : (
            <div className="space-y-3">
              {todayClasses.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center gap-4 rounded-lg bg-muted/50 px-4 py-3"
                >
                  <div className="flex-1">
                    <span className="font-heading text-sm font-bold text-foreground">{o.subjectCode}</span>
                    <span className="ml-2 text-sm text-foreground">{o.subjectTitle}</span>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {o.schedule} · {o.room}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {o.programName} · {o.yearLevel} · {o.semesterName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
            Recently Updated Grades
          </h2>
          {recentGrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">No grades updated recently</p>
          ) : (
            <div className="space-y-2">
              {recentGrades.map((g, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-foreground">{g.subjectCode}</span>
                    <span className="text-muted-foreground"> - {g.studentName}</span>
                  </div>
                  <span className={`font-medium ${getGradeStatus(g.grade).color}`}>
                    {g.grade.toFixed(2)} ({g.period})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
            Recent Notifications
          </h2>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications available</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs"
                >
                  <p className="font-medium text-foreground">{notification.title}</p>
                  <p className="mt-1 text-muted-foreground">{notification.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
            Latest Announcements
          </h2>
          {recentAnnouncements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements available</p>
          ) : (
            <div className="space-y-2">
              {recentAnnouncements.map((a, i) => (
                <div key={i} className="text-xs">
                  <p className="font-medium text-foreground line-clamp-1">{a.title}</p>
                  <p className="text-muted-foreground line-clamp-2">{a.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}