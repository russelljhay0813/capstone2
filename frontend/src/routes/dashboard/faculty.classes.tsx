import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Users, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchSubjectOfferings, type SubjectOffering } from "@/lib/api";
import { fetchEnrollments, fetchStudents, fetchGrades, fetchAttendanceRecords } from "@/lib/api";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard/faculty/classes")({
  component: FacultyClassList,
});

function FacultyClassList() {
  const { user } = useAuth();
  const [facultyOfferings, setFacultyOfferings] = useState<SubjectOffering[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, string>>({});

  const loadFacultyOfferings = useCallback(async () => {
    if (!user?.id) return;
    try {
      const allOfferings = await fetchSubjectOfferings();
      setFacultyOfferings(allOfferings.filter((o) => o.facultyId === (user.facultyId || user.id)));
    } catch {
      setFacultyOfferings([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadFacultyOfferings();
  }, [loadFacultyOfferings]);

  useEffect(() => {
    if (!selectedOfferingId) {
      setEnrolledStudents([]);
      setGrades([]);
      setAttendanceStatus({});
      return;
    }

    const loadData = async () => {
      try {
        const enrollments = await fetchEnrollments({ offeringId: selectedOfferingId });
        const studentIds = enrollments.map((e) => e.studentId);
        const allStudents = await fetchStudents();
        const offeringStudents = allStudents.filter((s) => studentIds.includes(s.id));
        setEnrolledStudents(offeringStudents);

        const allGrades = await fetchGrades({ offeringId: selectedOfferingId });
        setGrades(allGrades);

        const statusMap: Record<string, string> = {};
        for (const studentId of studentIds) {
          try {
            const records = await fetchAttendanceRecords({
              offeringId: selectedOfferingId,
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
        setGrades([]);
        setAttendanceStatus({});
      }
    };
    loadData();
  }, [selectedOfferingId]);

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

  const selectedOffering = facultyOfferings.find((o) => o.id === selectedOfferingId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Class List</h1>
        <p className="text-sm text-muted-foreground">
          View students enrolled in your assigned subjects
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {facultyOfferings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subject offerings assigned yet.</p>
        ) : (
          facultyOfferings.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelectedOfferingId(o.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedOfferingId === o.id
                  ? "bg-primary text-primary-foreground"
                  : "border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {o.subjectCode}
            </button>
          ))
        )}
      </div>

      {selectedOffering && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-sm font-semibold text-card-foreground">
                {selectedOffering.subjectCode} - {selectedOffering.subjectTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedOffering.schedule} · {selectedOffering.room}
              </p>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="pl-8 text-xs h-8"
              />
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students enrolled.</p>
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
                        {attendanceStatus[student.id] || "—"}
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
      )}
    </div>
  );
}