import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Calendar, Search, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { fetchAttendanceRecords, fetchSubjectOfferings } from "@/lib/api";

export const Route = createFileRoute("/dashboard/student/attendance")({
  component: StudentAttendance,
});

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  present: { label: "Present", color: "text-success bg-success/10", icon: CheckCircle },
  absent: { label: "Absent", color: "text-destructive bg-destructive/10", icon: XCircle },
  late: { label: "Late", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  excused: { label: "Excused", color: "text-blue-600 bg-blue-50", icon: Clock },
};

function StudentAttendance() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // user.studentId is the human-readable ID; we need to get the internal UUID to query attendance.
  // The backend API should accept the human-readable studentId or we need to resolve it.
  // We'll assume the API accepts studentId (human) as a filter and returns records with studentId (UUID) in response.
  // For display, we'll match offering IDs to get subject codes.

  const load = useCallback(async () => {
    if (!user?.studentId) return;
    try {
      const [attendanceData, offeringsData] = await Promise.all([
        fetchAttendanceRecords({ studentId: user.studentId }), // API accepts human-readable studentId
        fetchSubjectOfferings(),
      ]);
      setRecords(attendanceData.sort((a: any, b: any) => b.date.localeCompare(a.date)));
      setOfferings(offeringsData);
    } catch {
      setRecords([]);
      setOfferings([]);
    } finally {
      setLoading(false);
    }
  }, [user?.studentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onChange = () => {
      void load();
    };
    window.addEventListener("bwest:attendance-changed", onChange);
    return () => {
      window.removeEventListener("bwest:attendance-changed", onChange);
    };
  }, [load]);

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return r.date.includes(q) || (r.status && r.status.toLowerCase().includes(q));
  });

  const stats = {
    total: records.length,
    present: records.filter((r) => r.status === "present" || r.status === "late").length,
    absent: records.filter((r) => r.status === "absent").length,
    excused: records.filter((r) => r.status === "excused").length,
  };

  // Map offeringId to subject code/title
  const offeringMap = Object.fromEntries(
    offerings.map((o) => [o.id, { code: o.subjectCode, title: o.subjectTitle }])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">Your attendance records across all subjects</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { title: "Total Records", value: stats.total, color: "text-foreground" },
          { title: "Present / Late", value: stats.present, color: "text-success" },
          { title: "Absent", value: stats.absent, color: "text-destructive" },
          { title: "Excused", value: stats.excused, color: "text-yellow-600" },
        ].map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <p className="text-xs text-muted-foreground">{s.title}</p>
            <p className={`mt-1 font-heading text-2xl font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by date or status..."
          className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading attendance...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No attendance records found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const config = STATUS_CONFIG[r.status] || {
                  label: r.status,
                  color: "text-muted-foreground bg-muted",
                  icon: Clock,
                };
                const Icon = config.icon;
                const offering = offeringMap[r.subjectOfferingId];
                return (
                  <motion.tr
                    key={`${r.id}-${r.date}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-foreground">{r.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {offering ? `${offering.code} — ${offering.title}` : r.subjectOfferingId || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}