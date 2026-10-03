import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Users, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { fetchAdminAnalytics, type AdminAnalytics } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/dashboard/admin/analytics")({
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") return;

    let cancelled = false;
    fetchAdminAnalytics()
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Unable to load analytics.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  if (!user || user.role !== "admin") {
    return (
      <p className="text-sm text-muted-foreground" role="alert">
        Administrator access is required to view analytics.
      </p>
    );
  }

  const stats = [
    { title: "Total Students", value: analytics?.totalStudents, icon: Users },
    { title: "Active Faculty", value: analytics?.activeFaculty, icon: TrendingUp },
    { title: "Registrars", value: analytics?.registrars, icon: BookOpen },
    { title: "Subject Offerings", value: analytics?.subjectOfferings, icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Institutional performance and trends</p>
      </div>

      {loadError && (
        <p className="text-sm text-destructive" role="alert">
          Unable to load analytics: {loadError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <StatCard {...stat} value={stat.value ?? (isLoading ? "Loading" : "Unavailable")} />
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground">
          Students by Program
        </h2>
        {analytics ? (
          <div className="mt-4 space-y-3">
            {analytics.studentsByProgram.map((program) => (
              <div
                key={program.program}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
              >
                <span className="text-sm font-medium text-foreground">{program.program}</span>
                <span className="text-sm font-medium text-foreground">{program.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
            {isLoading ? "Loading program distribution…" : "Program distribution is unavailable."}
          </p>
        )}
      </div>
    </div>
  );
}
