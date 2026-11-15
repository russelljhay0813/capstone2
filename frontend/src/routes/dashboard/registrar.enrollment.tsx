import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Search, CheckCircle, Clock, XCircle, BookPlus, Eye, X } from "lucide-react";
import { motion } from "framer-motion";
import {
  getApprovedStudents,
  REGISTRATIONS_EVENT,
  type StudentRegistration,
} from "@/lib/registrations-store";
import {
  fetchAcademicStructure,
  type AcademicStructure,
  fetchUsers,
  type UserAccount,
  fetchSubjectOfferings,
  fetchEnrollments,
  enrollStudent,
} from "@/lib/api";
import { fetchPrograms } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/registrar/enrollment")({
  component: RegistrarEnrollment,
});

function RegistrarEnrollment() {
  const [activeStudents, setActiveStudents] = useState<StudentRegistration[]>([]);
  const [facultyUsers, setFacultyUsers] = useState<UserAccount[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<string[]>([]);
  const [subjectOfferings, setSubjectOfferings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRegistration | null>(null);
  const [academicStructure, setAcademicStructure] = useState<AcademicStructure>({
    academicYears: [],
    yearLevels: [],
    semesters: [],
  });
  const [selectedYearLevel, setSelectedYearLevel] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [availableOfferings, setAvailableOfferings] = useState<any[]>([]);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const loadPrograms = async () => {
      try {
        const data = await fetchPrograms();
        setPrograms(data);
      } catch {
        setPrograms([]);
      }
    };
    loadPrograms();
  }, []);

  useEffect(() => {
    const loadStudents = async () => {
      const approved = await getApprovedStudents();
      setActiveStudents(approved as any);
    };
    loadStudents();
    const onChange = () => loadStudents();
    window.addEventListener(REGISTRATIONS_EVENT, onChange);
    return () => window.removeEventListener(REGISTRATIONS_EVENT, onChange);
  }, []);

  useEffect(() => {
    const loadFaculty = async () => {
      const faculty = await fetchUsers("faculty");
      setFacultyUsers(faculty as any);
    };
    loadFaculty();

    fetchAcademicStructure()
      .then((structure) => setAcademicStructure(structure))
      .catch(() => setAcademicStructure({ academicYears: [], yearLevels: [], semesters: [] }));
  }, []);

  const yearLevels = academicStructure.yearLevels.length
    ? academicStructure.yearLevels
    : ["1st Year", "2nd Year", "3rd Year", "4th Year"];
  const semesters = academicStructure.semesters.length
    ? academicStructure.semesters
    : ["1st Semester", "2nd Semester"];

  useEffect(() => {
    if (yearLevels.length && !selectedYearLevel) {
      setSelectedYearLevel(yearLevels[0]);
    }
    if (semesters.length && !selectedSemester) {
      setSelectedSemester(semesters[0]);
    }
    if (academicStructure.academicYears.length && !selectedAcademicYear) {
      setSelectedAcademicYear(academicStructure.academicYears[0]);
    }
  }, [
    academicStructure.academicYears.length,
    yearLevels,
    semesters,
    selectedYearLevel,
    selectedSemester,
    selectedAcademicYear,
  ]);

  useEffect(() => {
    const loadEnrollments = async () => {
      const data = await fetchEnrollments();
      setEnrollments(data);
    };
    loadEnrollments();
  }, []);

  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const data = await fetchSubjectOfferings({
          academicYear: selectedAcademicYear,
          semester: selectedSemester,
        });
        setSubjectOfferings(data);
      } catch {
        setSubjectOfferings([]);
      }
    };
    if (selectedAcademicYear && selectedSemester) {
      loadOfferings();
    }
  }, [selectedAcademicYear, selectedSemester]);

  const filteredStudents = activeStudents.filter((s) => {
    const matchSearch =
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase());
    const matchProgram = programFilter === "All" || s.program === programFilter;
    const matchYear = yearFilter === "All" || s.yearLevel === yearFilter;
    return matchSearch && matchProgram && matchYear;
  });

  const loadOfferingsForStudent = (student: StudentRegistration, yearLevel: string, semester: string) => {
    // Find offerings that match the student's program and year/semester
    const filtered = subjectOfferings.filter(
      (o) =>
        o.programName === student.program &&
        o.yearLevel === yearLevel &&
        o.semesterName === semester &&
        o.status === "active"
    );
    setAvailableOfferings(filtered);
  };

  const handleOpenEnroll = (student: StudentRegistration) => {
    const yearLevel = student.yearLevel || yearLevels[0];
    const semester = semesters[0];
    const academicYear = academicStructure.academicYears[0] || `${currentYear}-${currentYear + 1}`;

    setSelectedStudent(student);
    setSelectedYearLevel(yearLevel);
    setSelectedSemester(semester);
    setSelectedAcademicYear(academicYear);
    setShowEnrollModal(true);
    loadOfferingsForStudent(student, yearLevel, semester);
  };

  const handleEnrollStudent = async () => {
    if (!selectedStudent || availableOfferings.length === 0) {
      toast.error("No offerings available for this student");
      return;
    }

    const offeringIds = availableOfferings.map((o) => o.id);
    try {
      await enrollStudent(selectedStudent.studentId, offeringIds);
      toast.success(`Enrolled ${selectedStudent.firstName} in ${offeringIds.length} offerings`);
      setShowEnrollModal(false);
      // Refresh enrollments
      const data = await fetchEnrollments();
      setEnrollments(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to enroll student");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Enrollment Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage student enrollments by program and year level
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Students</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">
            {activeStudents.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Enrolled This Term</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">
            {
              enrollments.filter((e) => {
                if (e.status !== "enrolled") return false;
                if (selectedAcademicYear && e.academicYear !== selectedAcademicYear) return false;
                if (selectedSemester && e.semester !== selectedSemester) return false;
                return true;
              }).length
            }
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Available Subject Offerings</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">
            {subjectOfferings.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Faculty Available</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">
            {facultyUsers.length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          className="rounded-lg border bg-card px-3 py-1.5 text-xs"
          aria-label="Filter by program"
        >
          <option value="All">All Programs</option>
          {programs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border bg-card px-3 py-1.5 text-xs"
          aria-label="Filter by year level"
        >
          <option value="All">All Years</option>
          {yearLevels.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Program</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Year Level</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Enrolled Subjects
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((s, i) => {
              const studentEnrollments = enrollments.filter(
                (e) => e.studentId === s.id && e.status === "enrolled",
              );
              return (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {s.studentId}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.program}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.yearLevel}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {studentEnrollments.length} offerings
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedStudent(s)}
                        className="rounded-lg border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        <Eye className="h-3.5 w-3.5 inline mr-1" /> View
                      </button>
                      <button
                        onClick={() => handleOpenEnroll(s)}
                        className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                      >
                        <BookPlus className="h-3.5 w-3.5 inline mr-1" /> Enroll
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No students found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View Enrolled Subjects Modal */}
      {selectedStudent && !showEnrollModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedStudent(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-foreground">Enrolled Offerings</h2>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close enrolled offerings dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedStudent.firstName} {selectedStudent.lastName}
            </p>
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {enrollments
                .filter((e) => e.studentId === selectedStudent.id && e.status === "enrolled")
                .map((e) => {
                  const offering = subjectOfferings.find((o) => o.id === e.subjectOfferingId);
                  return (
                    <div
                      key={e.id}
                      className="rounded-lg bg-muted/50 px-3 py-2 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {offering?.subjectCode || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {offering?.subjectTitle || "Unknown Subject"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{offering?.semesterName}</span>
                    </div>
                  );
                })}
              {enrollments.filter((e) => e.studentId === selectedStudent.id && e.status === "enrolled")
                .length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No enrolled offerings
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Enroll Modal */}
      {showEnrollModal && selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowEnrollModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-lg font-bold text-foreground mb-4">Enroll Student</h2>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium text-foreground">
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{selectedStudent.program}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Year Level</label>
                  <select
                    value={selectedYearLevel}
                    onChange={(e) => {
                      setSelectedYearLevel(e.target.value);
                      loadOfferingsForStudent(selectedStudent, e.target.value, selectedSemester);
                    }}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    aria-label="Select year level"
                  >
                    {yearLevels.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Semester</label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => {
                      setSelectedSemester(e.target.value);
                      loadOfferingsForStudent(selectedStudent, selectedYearLevel, e.target.value);
                    }}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    aria-label="Select semester"
                  >
                    {semesters.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Academic Year</label>
                <input
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  placeholder={`${currentYear}-${currentYear + 1}`}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-foreground mb-2">Available Offerings:</p>
                <div className="flex flex-wrap gap-1">
                  {availableOfferings.map((o) => (
                    <span
                      key={o.id}
                      className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success"
                    >
                      {o.subjectCode}
                    </span>
                  ))}
                  {availableOfferings.length === 0 && (
                    <span className="text-xs text-muted-foreground">No offerings available</span>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowEnrollModal(false)}
                  className="rounded-lg border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEnrollStudent}
                  disabled={availableOfferings.length === 0}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Enroll Student
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}