import { createFileRoute } from "@tanstack/react-router";
import { Shield, AlertTriangle, Lock, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { useActivityLogs, useUsers } from "@/lib/users-store";

export const Route = createFileRoute("/dashboard/admin/security")({
  component: AdminSecurity,
});

function AdminSecurity() {
  const users = useUsers();
  const activityLogs = useActivityLogs();

  const activeUsers = users.filter((u) => u.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Security</h1>
        <p className="text-sm text-muted-foreground">System security and audit logs</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Active Users", value: activeUsers, icon: Shield },
          {
            title: "Account Types",
            value: users.length > 0 ? "Active" : "No data",
            icon: Lock,
            subtitle: "Registered users",
          },
          {
            title: "New Accounts",
            value: users.filter((u) => {
              const created = new Date(u.createdAt);
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return created > thirtyDaysAgo;
            }).length,
            icon: Eye,
            subtitle: "Last 30 days",
          },
        ].map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <StatCard {...s} />
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground">Recent Activity</h2>
        {activityLogs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground py-8 text-center">
            No activity recorded yet.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {activityLogs.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-success" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{log.action}</p>
                    <p className="text-xs text-muted-foreground">{log.details}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(log.createdAt).toLocaleDateString()}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}