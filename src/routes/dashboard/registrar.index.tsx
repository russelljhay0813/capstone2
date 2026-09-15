import { createFileRoute } from "@tanstack/react-router";
import { StatCard } from "@/components/StatCard";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  ClipboardList,
  BookOpen,
  Building2,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { fetchRegistrarDashboardStats, type RegistrarDashboardStats } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard/registrar/")({
  component: RegistrarDashboard,
});

const initialStats: RegistrarDashboardStats = {
  pendingApplications: 0,
  approvedStudents: 0,
  pendingEnrollments: 0,
  activeStudents: 0,
  totalSubjects: 0,
  assignedFaculty: 0,
  programsOffered: 0,
  eligibleReenrollment: 0,
  recentActivities: [],
};

function RegistrarDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<RegistrarDashboardStats>(initialStats);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const loadStats = async () => {
    try {
      const data = await fetchRegistrarDashboardStats();
      setStats(data);
      setRecentActivities(data.recentActivities ?? []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Registrar Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Staff ID: <span className="font-mono text-foreground">{user?.userId || "—"}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Pending Applications",
            value: stats.pendingApplications,
            icon: Users,
            trend: { value: "Awaiting review", positive: false },
          },
          {
            title: "Approved Students",
            value: stats.approvedStudents,
            icon: UserCheck,
            trend: { value: "Active", positive: true },
          },
          {
            title: "Pending Enrollments",
            value: stats.pendingEnrollments,
            icon: ClipboardList,
            trend: { value: "Current term", positive: true },
          },
          { title: "Active Students", value: stats.activeStudents, icon: GraduationCap },
        ].map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Subject Offerings", value: stats.totalSubjects, icon: BookOpen },
          { title: "Assigned Faculty", value: stats.assignedFaculty, icon: Users },
          { title: "Programs Offered", value: stats.programsOffered, icon: Building2 },
          {
            title: "Eligible for Re-enrollment",
            value: stats.eligibleReenrollment,
            icon: RefreshCw,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 + 0.4 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground">
          Recent Activities
        </h2>
        <div className="mt-4 space-y-3">
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activities</p>
          ) : (
            recentActivities.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
              >
                <span className="text-sm font-medium text-foreground">{a.message}</span>
                <span className="text-xs text-muted-foreground">
                  {a.date ? new Date(a.date).toLocaleString() : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}