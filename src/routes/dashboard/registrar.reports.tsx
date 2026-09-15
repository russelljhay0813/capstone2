import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Users, BookOpen, GraduationCap, Download } from "lucide-react";
import {
  fetchReportEnrollment,
  fetchReportFacultyLoad,
  fetchReportStudents,
  fetchReportCurriculum,
} from "@/lib/api";

type ReportType = "enrollment" | "faculty" | "students" | "curriculum";

export const Route = createFileRoute("/dashboard/registrar/reports")({
  component: RegistrarReports,
});

function RegistrarReports() {
  const [reportType, setReportType] = useState<ReportType>("enrollment");
  const [enrollmentData, setEnrollmentData] = useState<any>(null);
  const [facultyData, setFacultyData] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [curriculumData, setCurriculumData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (reportType === "enrollment") {
        const data = await fetchReportEnrollment();
        setEnrollmentData(data);
      } else if (reportType === "faculty") {
        const data = await fetchReportFacultyLoad();
        setFacultyData(data);
      } else if (reportType === "students") {
        const data = await fetchReportStudents();
        setStudentsData(data);
      } else if (reportType === "curriculum") {
        const data = await fetchReportCurriculum();
        setCurriculumData(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType]);

  const handleExport = () => {
    const csvEscape = (value: unknown): string => {
      const text = value == null ? "" : String(value);
      if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    let csv = "";
    if (reportType === "enrollment" && enrollmentData) {
      csv = "Program,Count\n";
      Object.entries(enrollmentData.byProgram || {}).forEach(
        ([k, v]) => (csv += `${csvEscape(k)},${csvEscape(v)}\n`),
      );
      csv += "\nYear Level,Count\n";
      Object.entries(enrollmentData.byYear || {}).forEach(
        ([k, v]) => (csv += `${csvEscape(k)},${csvEscape(v)}\n`),
      );
      csv += "\nSemester,Count\n";
      Object.entries(enrollmentData.bySemester || {}).forEach(
        ([k, v]) => (csv += `${csvEscape(k)},${csvEscape(v)}\n`),
      );
      csv += `\nTotal Enrolled,${csvEscape(enrollmentData.totalEnrolled || 0)}\n`;
    } else if (reportType === "faculty") {
      csv = "Faculty ID,Name,Subjects,Units\n";
      facultyData.forEach(
        (f) =>
          (csv += `${csvEscape(f.facultyId)},${csvEscape(f.name)},${csvEscape(f.subjectCount)},${csvEscape(f.totalUnits)}\n`),
      );
    } else if (reportType === "students") {
      csv = "Student ID,Name,Program,Year Level,Semester\n";
      studentsData.forEach(
        (s) =>
          (csv += `${csvEscape(s.studentId)},${csvEscape(`${s.firstName} ${s.lastName}`)},${csvEscape(s.program)},${csvEscape(s.yearLevel)},${csvEscape(s.semester)}\n`),
      );
    } else if (reportType === "curriculum") {
      csv = "Program,Year,Semester,Subject Code,Title,Units\n";
      curriculumData.forEach(
        (s) =>
          (csv += `${csvEscape(s.programName)},${csvEscape(s.yearLevel)},${csvEscape(s.semester)},${csvEscape(s.subjectCode)},${csvEscape(s.subjectTitle)},${csvEscape(s.units)}\n`),
      );
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reports = [
    {
      id: "enrollment" as ReportType,
      label: "Enrollment Report",
      icon: Users,
      desc: "Student enrollment by program, year, and semester",
    },
    {
      id: "faculty" as ReportType,
      label: "Faculty Load Report",
      icon: Users,
      desc: "Subject assignments and teaching load per faculty",
    },
    {
      id: "students" as ReportType,
      label: "Student List",
      icon: GraduationCap,
      desc: "Complete list of approved students",
    },
    {
      id: "curriculum" as ReportType,
      label: "Curriculum Report",
      icon: BookOpen,
      desc: "All curriculum subjects across programs",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate reports from real database records</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => setReportType(r.id)}
            className={`rounded-xl border bg-card p-4 shadow-sm text-left transition-colors ${reportType === r.id ? "border-accent bg-accent/5" : "hover:border-accent/50"}`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <r.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-sm font-bold text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-foreground">
          {reports.find((r) => r.id === reportType)?.label}
        </h2>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading report...</p>
      ) : reportType === "enrollment" && enrollmentData ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <h3 className="font-heading text-sm font-semibold text-foreground mb-2">
                By Program
              </h3>
              {Object.entries(enrollmentData.byProgram || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b last:border-0">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-xs font-medium text-foreground">{v as number}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-foreground mb-2">
                By Year Level
              </h3>
              {Object.entries(enrollmentData.byYear || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b last:border-0">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-xs font-medium text-foreground">{v as number}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-foreground mb-2">
                By Semester
              </h3>
              {Object.entries(enrollmentData.bySemester || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b last:border-0">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-xs font-medium text-foreground">{v as number}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Total Enrolled:{" "}
              <span className="font-bold text-foreground">{enrollmentData.totalEnrolled || 0}</span>
            </p>
          </div>
        </div>
      ) : reportType === "faculty" && facultyData.length > 0 ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Faculty ID
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Assigned Subjects
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Total Units
                </th>
              </tr>
            </thead>
            <tbody>
              {facultyData.map((f, i) => (
                <motion.tr
                  key={f.facultyId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {f.facultyId}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{f.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.subjectCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.totalUnits}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : reportType === "students" && studentsData.length > 0 ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Student ID
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Program</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Year Level
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Semester</th>
              </tr>
            </thead>
            <tbody>
              {studentsData.map((s, i) => (
                <motion.tr
                  key={s.studentId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {s.studentId}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{`${s.firstName} ${s.lastName}`}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.program}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.yearLevel}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.semester}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : reportType === "curriculum" && curriculumData.length > 0 ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Program</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Year Level
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Semester</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Subject Code
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Units</th>
              </tr>
            </thead>
            <tbody>
              {curriculumData.map((s, i) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-foreground">{s.programName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.yearLevel}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.semester}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{s.subjectCode}</td>
                  <td className="px-4 py-3 text-foreground">{s.subjectTitle}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.units}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Select a report type to view</p>
        </div>
      )}
    </div>
  );
}