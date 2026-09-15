import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import { fetchStudents, fetchEligibleReenrollments, reenrollStudent } from "@/lib/api";
import { getApprovedStudents, REGISTRATIONS_EVENT } from "@/lib/registrations-store";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/registrar/reenrollment")({
  component: RegistrarReenrollment,
});

function RegistrarReenrollment() {
  const [students, setStudents] = useState<any[]>([]);
  const [eligible, setEligible] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadEligible = async () => {
    try {
      const data = await fetchEligibleReenrollments();
      setEligible(data);
    } catch {
      setEligible([]);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await getApprovedStudents();
      setStudents(data as any[]);
    } catch {
      setStudents([]);
    }
  };

  useEffect(() => {
    loadEligible();
    loadStudents();
    const onChange = () => {
      loadEligible();
      loadStudents();
    };
    window.addEventListener(REGISTRATIONS_EVENT, onChange);
    return () => window.removeEventListener(REGISTRATIONS_EVENT, onChange);
  }, []);

  const filteredEligible = eligible.filter((s) => {
    const q = search.toLowerCase();
    return (
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      (s.program && s.program.toLowerCase().includes(q))
    );
  });

  const handleReenroll = async (student: any) => {
    if (!confirm(`Approve re-enrollment for ${student.firstName} ${student.lastName}?`)) return;
    setLoading(true);
    try {
      await reenrollStudent(student.studentId, {
        nextAcademicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      });
      toast.success("Re-enrollment approved. Student advanced to next semester.");
      loadEligible();
      loadStudents();
    } catch (err: any) {
      toast.error(err?.message || "Failed to process re-enrollment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Re-enrollment</h1>
        <p className="text-sm text-muted-foreground">
          Approve re-enrollment for students with finalized grades
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Eligible Students</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{eligible.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Active Students</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{students.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Awaiting Re-enrollment</p>
          <p className="mt-1 font-heading text-2xl font-bold text-warning">{eligible.length}</p>
        </div>
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Current Year
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Current Semester
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEligible.map((s, i) => (
              <motion.tr
                key={s.studentId}
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
                <td className="px-4 py-3 text-muted-foreground">{s.yearLevel}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.semester}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-success/10 text-success">
                    Eligible
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleReenroll(s)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-success-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <ArrowRight className="h-3.5 w-3.5" /> Approve Re-enrollment
                  </button>
                </td>
              </motion.tr>
            ))}
            {filteredEligible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No eligible students for re-enrollment
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}