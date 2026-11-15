import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { UserCheck, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  fetchSubjectOfferings,
  fetchStudents,
  fetchEnrollments,
  fetchAttendanceRecords,
  saveAttendanceRecord,
  type SubjectOffering,
  type StudentRegistration,
} from "@/lib/api";

export const Route = createFileRoute("/dashboard/faculty/attendance")({
  component: FacultyAttendance,
});

type AttendanceStatus = "present" | "absent" | "late" | "excused";

type StudentWithAttendance = Omit<StudentRegistration, "status"> & {
  status: AttendanceStatus;
};

function FacultyAttendance() {
  const { user } = useAuth();
  const [facultyOfferings, setFacultyOfferings] = useState<SubjectOffering[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

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

  const loadStudents = useCallback(async () => {
    if (!selectedOfferingId) {
      setStudents([]);
      return;
    }

    try {
      setLoading(true);
      // Fetch enrollments for this offering
      const enrollments = await fetchEnrollments({ offeringId: selectedOfferingId });
      const studentIds = enrollments.map((e) => e.studentId);
      const allStudents = await fetchStudents();
      const offeringStudents = allStudents.filter((s) => studentIds.includes(s.id));
      setStudents(offeringStudents.map((s) => ({ ...s, status: "present" })));
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedOfferingId]);

  const loadAttendance = useCallback(async () => {
    if (!selectedOfferingId) {
      setAttendanceMap({});
      return;
    }

    try {
      const records = await fetchAttendanceRecords({ offeringId: selectedOfferingId, date: selectedDate });
      const map = records.reduce(
        (acc, record) => {
          acc[record.studentId] = record.status as AttendanceStatus;
          return acc;
        },
        {} as Record<string, AttendanceStatus>,
      );
      setAttendanceMap(map);
    } catch {
      setAttendanceMap({});
    }
  }, [selectedOfferingId, selectedDate]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const markStudent = useCallback(
    async (studentId: string, status: AttendanceStatus) => {
      if (!selectedOfferingId || !selectedDate) return;
      try {
        await saveAttendanceRecord({
          studentId,
          offeringId: selectedOfferingId,
          date: selectedDate,
          status,
        });
        setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
        toast.success(`Attendance marked as ${status}`);
      } catch {
        toast.error("Failed to mark attendance");
      }
    },
    [selectedOfferingId, selectedDate],
  );

  const studentList = useMemo(
    () =>
      students.map((student) => ({
        ...student,
        status: attendanceMap[student.id] ?? "present",
      })),
    [attendanceMap, students],
  );

  const counts = useMemo(() => {
    const p = studentList.filter((s) => s.status === "present").length;
    const a = studentList.filter((s) => s.status === "absent").length;
    const l = studentList.filter((s) => s.status === "late").length;
    const e = studentList.filter((s) => s.status === "excused").length;
    return { present: p, absent: a, late: l, excused: e, total: studentList.length };
  }, [studentList]);

  const selectedOffering = facultyOfferings.find((o) => o.id === selectedOfferingId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Record attendance for your assigned subjects -{" "}
          {new Date(selectedDate).toLocaleDateString("en-PH", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="attendance-date" className="text-xs text-muted-foreground">
            Select Date
          </label>
          <input
            id="attendance-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {facultyOfferings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No subject offerings assigned yet. Offerings are created by the Registrar.
          </p>
        ) : (
          facultyOfferings.map((o) => (
            <Button
              key={o.id}
              variant={selectedOfferingId === o.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedOfferingId(o.id)}
            >
              {o.subjectCode} - {o.subjectTitle}
            </Button>
          ))
        )}
      </div>

      {selectedOffering && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-accent" />
              <h2 className="font-heading text-sm font-semibold text-card-foreground">
                {selectedOffering.subjectCode} — {selectedOffering.subjectTitle}
              </h2>
            </div>

            <div className="mb-4 flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" /> Present: {counts.present}
              </span>
              <span className="flex items-center gap-1 text-yellow-500">
                <Clock className="h-3 w-3" /> Late: {counts.late}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <XCircle className="h-3 w-3" /> Absent: {counts.absent}
              </span>
              <span className="flex items-center gap-1 text-blue-500">
                <AlertCircle className="h-3 w-3" /> Excused: {counts.excused}
              </span>
              <span className="text-muted-foreground">Total: {counts.total}</span>
            </div>

            <div className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading attendance snapshot...</p>
              ) : studentList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No students enrolled in this subject offering.
                </p>
              ) : (
                studentList.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                        {student.firstName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {student.firstName} {student.lastName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(["present", "late", "absent", "excused"] as const).map((s) => {
                        const isActive = student.status === s;
                        const icon =
                          s === "present"
                            ? CheckCircle2
                            : s === "late"
                              ? Clock
                              : s === "absent"
                                ? XCircle
                                : AlertCircle;
                        return (
                          <Button
                            key={s}
                            size="icon"
                            variant={isActive ? "default" : "outline"}
                            onClick={() => markStudent(student.id, s)}
                            className={`h-7 w-7 ${isActive ? "" : "opacity-60 hover:opacity-100"}`}
                            aria-label={s}
                          >
                            {icon({ className: "h-3.5 w-3.5" })}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}