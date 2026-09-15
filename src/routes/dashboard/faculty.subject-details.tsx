import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Users, Calendar, MapPin, GraduationCap, ArrowLeft, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchSubjectOfferings, type SubjectOffering } from "@/lib/api";
import { fetchEnrollments, fetchStudents, fetchGrades, fetchAttendanceRecords } from "@/lib/api";

export const Route = createFileRoute("/dashboard/faculty/subject-details")({
  component: SubjectDetailsPage,
});

function SubjectDetailsPage() {
  const { user } = useAuth();
  const offeringId = (Route.useParams() as any).offeringId as string | undefined;
  const [offering, setOffering] = useState<SubjectOffering | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<any[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const loadOffering = useCallback(async () => {
    try {
      const allOfferings = await fetchSubjectOfferings();
      const found = allOfferings.find((o) => o.id === offeringId);
      if (found && found.facultyId === user?.id) {
        setOffering(found);
      } else {
        setOffering(null);
      }
    } catch {
      setOffering(null);
    }
  }, [offeringId, user?.id]);

  useEffect(() => {
    loadOffering();
  }, [loadOffering]);

  useEffect(() => {
    const loadEnrolledStudents = async () => {
      if (!offering) return;
      try {
        const enrollments = await fetchEnrollments({ offeringId: offering.id });
        const studentIds = enrollments.map((e) => e.studentId);
        const allStudents = await fetchStudents();
        const offeringStudents = allStudents.filter((s) => studentIds.includes(s.id));
        setEnrolledStudents(offeringStudents);

        const statusMap: Record<string, string> = {};
        for (const studentId of studentIds) {
          try {
            const records = await fetchAttendanceRecords({
              offeringId: offering.id,
              studentId,
            });
            const latest = records.sort((a, b) => b.updatedAt - a.updatedAt)[0];
            statusMap[studentId] = latest
              ? latest.status.charAt(0).toUpperCase() + latest.status.slice(1)
              : "—";
          } catch {
            statusMap[studentId] = "—";
          }
        }
        setAttendanceStatus(statusMap);
      } catch {
        setEnrolledStudents([]);
      } finally {
        setLoading(false);
      }
    };
    loadEnrolledStudents();
  }, [offering]);

  useEffect(() => {
    const loadGrades = async () => {
      if (!offering) return;
      try {
        const allGrades = await fetchGrades({ offeringId: offering.id });
        setGrades(allGrades);
      } catch {
        setGrades([]);
      }
    };
    loadGrades();
  }, [offering]);

  const getStudentGrade = (studentId: string) => {
    const studentGrade = grades.find((g) => g.studentId === studentId && g.type === "overall");
    return studentGrade ? studentGrade.grade.toFixed(2) : "—";
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return enrolledStudents;
    return enrolledStudents.filter(
      (s) =>
        s.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentId?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [enrolledStudents, searchQuery]);

  if (!offering) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Subject offering not found or you do not have access to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard/faculty/subjects"
          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card hover:bg-muted"
          aria-label="Back to subjects"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">{offering.subjectCode}</h1>
          <p className="text-sm text-muted-foreground">{offering.subjectTitle}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
          Subject Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">Subject Code</span>
            <p className="font-medium text-foreground">{offering.subjectCode}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Subject Name</span>
            <p className="font-medium text-foreground">{offering.subjectTitle}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Units</span>
            <p className="font-medium text-foreground">{offering.units}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Program</span>
            <p className="font-medium text-foreground">{offering.programName || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Year Level</span>
            <p className="font-medium text-foreground">{offering.yearLevel || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Semester</span>
            <p className="font-medium text-foreground">{offering.semesterName || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Academic Year</span>
            <p className="font-medium text-foreground">{offering.academicYearCode || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Schedule</span>
            <p className="font-medium text-foreground">{offering.schedule || "TBA"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Room</span>
            <p className="font-medium text-foreground">{offering.room || "TBA"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-sm font-semibold text-card-foreground">
            Enrolled Students ({filteredStudents.length})
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students..."
              className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-xs focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading students...</p>
        ) : filteredStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students enrolled in this subject.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Student ID</th>
                  <th className="pb-2 pr-4">Student Name</th>
                  <th className="pb-2 pr-4">Attendance Status</th>
                  <th className="pb-2">Current Grade</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {student.studentId || student.id}
                    </td>
                    <td className="py-2 pr-4 text-foreground">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {attendanceStatus[student.id] || "Not Recorded"}
                    </td>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {getStudentGrade(student.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}