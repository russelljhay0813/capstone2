import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, GraduationCap, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchGrades, fetchSubjectOfferings } from "@/lib/api";

export const Route = createFileRoute("/dashboard/student/grades")({
  component: StudentGrades,
});

function gradeRemark(g: number): { label: string; tone: string } {
  if (g <= 1.25) return { label: "Excellent", tone: "bg-success/10 text-success" };
  if (g <= 1.75) return { label: "Very Good", tone: "bg-accent/10 text-accent" };
  if (g <= 2.25) return { label: "Good", tone: "bg-primary/10 text-primary" };
  if (g <= 3.0) return { label: "Passed", tone: "bg-warning/10 text-warning" };
  return { label: "Failed", tone: "bg-destructive/10 text-destructive" };
}

function StudentGrades() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.studentId) return;
      try {
        const [gradeData, offeringData] = await Promise.all([
          fetchGrades({ studentId: user.studentId }),
          fetchSubjectOfferings(),
        ]);
        setGrades(gradeData);
        setOfferings(offeringData);
      } catch {
        setGrades([]);
        setOfferings([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.studentId]);

  const rows = useMemo(
    () =>
      grades
        .map((grade) => {
          const offering = offerings.find((o) => o.id === grade.subjectOfferingId);
          if (!offering) return null;
          return {
            offering,
            grade: grade.grade,
            remarks: grade.remarks ?? "",
            period: grade.period,
            status: grade.status,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    [grades, offerings],
  );

  const totalUnits = rows.reduce((sum, row) => sum + (row.offering.units || 0), 0);
  const weighted = rows.reduce((sum, row) => sum + row.grade * (row.offering.units || 0), 0);
  const gwa = totalUnits > 0 ? weighted / totalUnits : 0;

  const honor =
    gwa > 0 && gwa <= 1.2
      ? "Summa Cum Laude"
      : gwa <= 1.45
        ? "Magna Cum Laude"
        : gwa <= 1.75
          ? "Cum Laude"
          : gwa <= 3.0
            ? "Regular Standing"
            : "—";

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Grades</h1>
          <p className="text-sm text-muted-foreground">Please sign in to view your grades.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading grades...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Grades</h1>
        <p className="text-sm text-muted-foreground">
          Academic performance for {user.name} ({user.studentId ?? "student"}).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <p className="text-xs">GWA</p>
          </div>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">
            {gwa > 0 ? gwa.toFixed(2) : "—"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" />
            <p className="text-xs">Offerings</p>
          </div>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{rows.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Units Earned</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{totalUnits}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Award className="h-3.5 w-3.5" />
            <p className="text-xs">Standing</p>
          </div>
          <p className="mt-1 font-heading text-base font-bold text-accent">{honor}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground">Grade Records</h2>

        {rows.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-lg bg-muted/50 px-4 py-10 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No grades yet. Grades will appear once your faculty enters them.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Subject</th>
                  <th className="px-4 py-2 font-medium">Instructor</th>
                  <th className="px-4 py-2 text-center font-medium">Units</th>
                  <th className="px-4 py-2 text-center font-medium">Grade</th>
                  <th className="px-4 py-2 text-center font-medium">Period</th>
                  <th className="px-4 py-2 text-right font-medium">Remark</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ offering, grade, period, status }, i) => {
                  const r = gradeRemark(grade);
                  return (
                    <motion.tr
                      key={offering.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-t"
                    >
                      <td className="px-4 py-3 font-heading text-xs font-bold text-foreground">
                        {offering.subjectCode}
                      </td>
                      <td className="px-4 py-3 text-foreground">{offering.subjectTitle}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{offering.facultyName || "—"}</td>
                      <td className="px-4 py-3 text-center text-xs text-foreground">{offering.units || 0}</td>
                      <td className="px-4 py-3 text-center font-heading text-sm font-bold text-accent">
                        {grade.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {period || "Overall"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.tone}`}
                        >
                          {r.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}