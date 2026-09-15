import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Search, Eye, Printer, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  getRegistrations,
  REGISTRATIONS_EVENT,
  type StudentRegistration,
} from "@/lib/registrations-store";
import {
  fetchGrades,
  fetchEnrollments,
  fetchAttendanceRecords,
  fetchSubjectOfferings,
  finalizeStudentRecords,
} from "@/lib/api";
import { useSubjects } from "@/lib/subjects-store";

export const Route = createFileRoute("/dashboard/registrar/records")({
  component: RegistrarRecords,
});

function RegistrarRecords() {
  const subjects = useSubjects();
  const [students, setStudents] = useState<StudentRegistration[]>([]);
  const [gradesMap, setGradesMap] = useState<Record<string, any[]>>({});
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any[]>>({});
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRegistration | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [offerings, setOfferings] = useState<any[]>([]);

  const loadStudents = useCallback(async () => {
    try {
      const approved = await getRegistrations();
      setStudents(approved.filter((s) => s.status === "approved"));
    } catch {
      setStudents([]);
    }
  }, []);

  const loadGrades = useCallback(async () => {
    try {
      const grades = await fetchGrades();
      const approvedStudents = (await getRegistrations()).filter((s) => s.status === "approved");
      const map: Record<string, any[]> = {};
      for (const student of approvedStudents) {
        // student.id is the UUID
        const studentGrades = grades.filter((g: any) => g.studentId === student.id);
        map[student.id] = studentGrades;
      }
      setGradesMap(map);
    } catch {
      setGradesMap({});
    }
  }, []);

  useEffect(() => {
    loadStudents();
    loadGrades();
    const onChange = () => {
      loadStudents();
      loadGrades();
    };
    window.addEventListener(REGISTRATIONS_EVENT, onChange);
    return () => window.removeEventListener(REGISTRATIONS_EVENT, onChange);
  }, [loadStudents, loadGrades]);

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

  const filtered = students.filter(
    (r) =>
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      r.studentId.includes(search),
  );

  const getAcademicStanding = (studentId: string) => {
    const grades = gradesMap[studentId] || [];
    if (grades.length === 0) return "No grades yet";
    const avg = grades.reduce((sum, g: any) => sum + g.grade, 0) / grades.length;
    if (avg >= 90) return "Excellent";
    if (avg >= 85) return "Very Good";
    if (avg >= 80) return "Good";
    if (avg >= 75) return "Passing";
    return "Needs Improvement";
  };

  const handleView = async (student: StudentRegistration) => {
    setSelectedStudent(student);
    setLoadingAttendance(true);
    try {
      // Fetch attendance for the student (using student UUID)
      const att = await fetchAttendanceRecords({ studentId: student.id });
      setStudentAttendance(att);
    } catch {
      setStudentAttendance([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const getAttendanceSummary = () => {
    const present = studentAttendance.filter((a) => a.status === "present").length;
    const absent = studentAttendance.filter((a) => a.status === "absent").length;
    const late = studentAttendance.filter((a) => a.status === "late").length;
    return { total: studentAttendance.length, present, absent, late };
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFinalizeRecords = async (student: StudentRegistration) => {
    if (!confirm(`Finalize all academic records for ${student.firstName} ${student.lastName}?`))
      return;
    try {
      const result = await finalizeStudentRecords(student.id, {});
      import("sonner").then(({ toast }) => {
        toast.success(`Academic records finalized. ${result.finalizedCount} records updated.`);
      });
      loadGrades();
    } catch (err: any) {
      import("sonner").then(({ toast }) => {
        toast.error(err?.message || "Failed to finalize records.");
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Academic Records</h1>
        <p className="text-sm text-muted-foreground">View and manage student academic records</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or student ID..."
          className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Program</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Year Level</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">GPA</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Units</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const grades = gradesMap[r.id] || [];
              const avg =
                grades.length > 0
                  ? grades.reduce((sum, g: any) => sum + g.grade, 0) / grades.length
                  : null;
              // Compute total units from offerings linked via subjectId
              const totalUnits = grades.reduce((sum, g: any) => {
                const offering = offerings.find((o) => o.id === g.subjectOfferingId);
                return sum + (offering?.units || 0);
              }, 0);
              return (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.studentId}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.program}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.yearLevel}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {avg !== null ? avg.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{totalUnits}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-success/10 text-success">
                      {r.status === "approved" ? "Enrolled" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button
                        onClick={() => handleFinalizeRecords(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Finalize
                      </button>
                      <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        <Printer className="h-3.5 w-3.5" /> Print
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedStudent(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl rounded-xl bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-foreground">Academic Record</h2>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedStudent.firstName} {selectedStudent.lastName} | {selectedStudent.studentId} |{" "}
              {selectedStudent.program}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Academic Standing</p>
                <p className="font-heading text-base font-bold text-foreground">
                  {getAcademicStanding(selectedStudent.id)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Attendance Summary</p>
                {loadingAttendance ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <>
                    <p className="font-heading text-base font-bold text-foreground">
                      {getAttendanceSummary().total} total
                    </p>
                    <p className="text-xs text-muted-foreground">
                      P: {getAttendanceSummary().present} | A: {getAttendanceSummary().absent} | L:{" "}
                      {getAttendanceSummary().late}
                    </p>
                  </>
                )}
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">GPA</p>
                <p className="font-heading text-base font-bold text-foreground">
                  {gradesMap[selectedStudent.id]?.length > 0
                    ? (
                        gradesMap[selectedStudent.id].reduce(
                          (sum, g: any) => sum + g.grade,
                          0,
                        ) / gradesMap[selectedStudent.id].length
                      ).toFixed(2)
                    : "—"}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="font-heading text-sm font-semibold text-foreground mb-2">
                Enrolled Offerings & Grades
              </h3>
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Code
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Title
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Grade
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradesMap[selectedStudent.id]?.map((g: any, idx: number) => {
                      const offering = offerings.find((o) => o.id === g.subjectOfferingId);
                      return (
                        <tr key={g.id} className={idx > 0 ? "border-t" : ""}>
                          <td className="px-4 py-2 font-mono text-xs text-foreground">
                            {offering?.subjectCode || "—"}
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {offering?.subjectTitle || "Unknown"}
                          </td>
                          <td className="px-4 py-2 font-medium text-foreground">{g.grade}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${g.status === "finalized" ? "bg-success/10 text-success" : g.status === "submitted" ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning"}`}
                            >
                              {g.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(!gradesMap[selectedStudent.id] ||
                      gradesMap[selectedStudent.id].length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                          No grades recorded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Printer className="h-4 w-4" /> Print Record
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}