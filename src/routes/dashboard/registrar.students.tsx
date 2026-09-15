import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Eye, Pencil, Archive } from "lucide-react";
import { getRegistrations, REGISTRATIONS_EVENT } from "@/lib/registrations-store";
import { updateStudent, fetchEnrollments } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/registrar/students")({
  component: RegistrarStudents,
});

function RegistrarStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const loadStudents = async () => {
    try {
      const data = await getRegistrations();
      setStudents(data.filter((s) => s.status === "approved"));
    } catch {
      setStudents([]);
    }
  };

  const loadEnrollments = async () => {
    try {
      const data = await fetchEnrollments();
      setEnrollments(data);
    } catch {
      setEnrollments([]);
    }
  };

  useEffect(() => {
    loadStudents();
    loadEnrollments();
    const onChange = () => loadStudents();
    window.addEventListener(REGISTRATIONS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(REGISTRATIONS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      s.program.toLowerCase().includes(q)
    );
  });

  const getEnrollmentStatus = (studentId: string) => {
    // studentId here is the human-readable one; we need to match with student.id in enrollments.
    // We'll use a map from studentId to student.id.
    const student = students.find((s) => s.studentId === studentId);
    if (!student) return "Unknown";
    const hasEnrollment = enrollments.some((e) => e.studentId === student.id);
    return hasEnrollment ? "Enrolled" : "Pending Enrollment";
  };

  const handleView = (student: any) => {
    setSelectedStudent(student);
    setEditMode(false);
  };

  const handleEdit = (student: any) => {
    setSelectedStudent(student);
    setEditMode(true);
    setEditForm({
      program: student.program,
      yearLevel: student.yearLevel,
      semester: student.semester,
      contactNumber: student.contactNumber,
      address: student.address,
    });
  };

  const handleArchive = async (student: any) => {
    if (!confirm(`Archive registration for ${student.firstName} ${student.lastName}?`)) return;
    try {
      await updateStudent(student.studentId, { status: "archived" });
      toast.success("Registration archived");
      loadStudents();
    } catch {
      toast.error("Failed to archive registration");
    }
  };

  const handleSave = async () => {
    if (!selectedStudent) return;
    try {
      await updateStudent(selectedStudent.studentId, editForm);
      toast.success("Registration updated");
      setEditMode(false);
      loadStudents();
    } catch {
      toast.error("Failed to update registration");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">
          Recently Registered Students
        </h1>
        <p className="text-sm text-muted-foreground">
          Review newly approved registrations and manage enrolled students.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, or program..."
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Semester</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Academic Year
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Registration Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Registration Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Enrollment Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.studentId}</td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {s.firstName} {s.lastName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.program}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.yearLevel || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.semester || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.academicYear || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-success/10 text-success capitalize">
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary capitalize">
                    {getEnrollmentStatus(s.studentId)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleView(s)}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    <button
                      onClick={() => handleEdit(s)}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Update
                    </button>
                    <button
                      onClick={() => handleArchive(s)}
                      className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  No registered students found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(selectedStudent || editMode) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => {
            setSelectedStudent(null);
            setEditMode(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-lg font-bold text-foreground mb-4">
              {editMode ? "Update Registration" : "Registration Details"}
            </h2>
            {selectedStudent && (
              <div className="grid gap-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Student ID</p>
                    <p className="font-medium text-foreground">{selectedStudent.studentId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Full Name</p>
                    <p className="font-medium text-foreground">
                      {selectedStudent.firstName}{" "}
                      {selectedStudent.middleName ? selectedStudent.middleName + " " : ""}
                      {selectedStudent.lastName}
                      {selectedStudent.suffix ? " " + selectedStudent.suffix : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{selectedStudent.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="font-medium text-foreground">{selectedStudent.contactNumber}</p>
                  </div>
                  {editMode ? (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground">Program</label>
                        <input
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                          value={editForm.program}
                          onChange={(e) => setEditForm({ ...editForm, program: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Year Level</label>
                        <input
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                          value={editForm.yearLevel}
                          onChange={(e) => setEditForm({ ...editForm, yearLevel: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Semester</label>
                        <input
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                          value={editForm.semester}
                          onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Contact Number</label>
                        <input
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                          value={editForm.contactNumber}
                          onChange={(e) =>
                            setEditForm({ ...editForm, contactNumber: e.target.value })
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Address</label>
                        <input
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Program</p>
                        <p className="font-medium text-foreground">{selectedStudent.program}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Year Level</p>
                        <p className="font-medium text-foreground">
                          {selectedStudent.yearLevel || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Semester</p>
                        <p className="font-medium text-foreground">
                          {selectedStudent.semester || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Address</p>
                        <p className="font-medium text-foreground">
                          {selectedStudent.address || "—"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setEditMode(false);
                }}
                className="rounded-lg border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                Close
              </button>
              {editMode && (
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Save Changes
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}