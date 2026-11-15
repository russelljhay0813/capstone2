import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { FileText, Search, Download } from "lucide-react";
import { motion } from "framer-motion";
import { fetchStudents } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/registrar/transcripts")({
  component: RegistrarTranscripts,
});

function RegistrarTranscripts() {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const data = await fetchStudents("approved");
        setStudents(data);
      } catch {
        setStudents([]);
      }
    };
    loadStudents();
  }, []);

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      (s.program && s.program.toLowerCase().includes(q))
    );
  });

  const handleDownload = (student: any) => {
    toast.success(`Transcript download started for ${student.firstName} ${student.lastName}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">
          Transcripts & Certificates
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate and download academic documents for students
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student name or ID..."
          className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Program</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((s, i) => (
              <motion.tr
                key={s.studentId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {s.firstName} {s.lastName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.studentId}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.program || "—"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDownload(s)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                </td>
              </motion.tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No students found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}