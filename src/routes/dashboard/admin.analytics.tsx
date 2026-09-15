import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Users, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { useUsers } from "@/lib/users-store";
import { useStudents, type Student } from "@/lib/students-store";
import { fetchSubjectOfferings, fetchPrograms } from "@/lib/api";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const users = useUsers();
  const students = useStudents();
  const [offeringsCount, setOfferingsCount] = useState(0);
  const [programs, setPrograms] = useState<string[]>([]);

  useEffect(() => {
    fetchSubjectOfferings()
      .then((offerings) => setOfferingsCount(offerings.length))
      .catch(() => setOfferingsCount(0));
    fetchPrograms()
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, []);

  // Count students with approved/active status
  const totalStudents = students.filter(
    (student: Student) =>
      student.status === "approved" ||
      student.status === "active"
  ).length;

  const totalFaculty = users.filter((user) => user.role === "faculty" && user.status === "active").length;
  const totalRegistrars = users.filter((user) => user.role === "registrar" && user.status === "active").length;

  // Program breakdown – in the new schema, program is not on student directly.
  // We use the enrollment data to determine program, but for a quick dashboard,
  // we show a message that program breakdown requires additional data.
  // For now, we'll show a placeholder or use the program from student if available.
  const programStats = programs
    .map((program: string) => ({
      program,
      // In the new schema, program is not stored on student.
      // We'll show a placeholder until we implement enrollment-based program lookup.
      count: 0,
    }))
    .filter((p) => p.count > 0);

  // For a more accurate count, we would need to fetch enrollments and map to programs.
  // For now, we just show a message.

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Institutional performance and trends</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Students", value: totalStudents, icon: Users },
          { title: "Active Faculty", value: totalFaculty, icon: TrendingUp },
          { title: "Registrars", value: totalRegistrars, icon: BookOpen },
          { title: "Subject Offerings", value: offeringsCount, icon: BarChart3 },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground">
          Students by Program
        </h2>
        {programStats.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground py-6 text-center">
            Program breakdown requires additional data. Please use the Reports section for detailed analytics.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {programStats.map((p) => (
              <div
                key={p.program}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
              >
                <span className="text-sm font-medium text-foreground">{p.program}</span>
                <span className="text-sm font-medium text-foreground">{p.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}