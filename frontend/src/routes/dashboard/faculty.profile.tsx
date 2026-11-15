import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { User, Mail, BookOpen, Building2, Camera, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchSubjectOfferings, type SubjectOffering } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/faculty/profile")({
  component: FacultyProfile,
});

function FacultyProfile() {
  const { user } = useAuth();
  const [assignedOfferings, setAssignedOfferings] = useState<SubjectOffering[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    const loadAssignedOfferings = async () => {
      if (!user?.id) return;
      try {
        const offerings = await fetchSubjectOfferings({ facultyId: user.facultyId || user.id });
        setAssignedOfferings(offerings);
      } catch {
        setAssignedOfferings([]);
      }
    };
    loadAssignedOfferings();
  }, [user?.id]);

  const handlePasswordChange = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("The passwords you entered do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Use at least 6 characters for your new password.");
      return;
    }

    setPasswordError("");
    setIsSavingPassword(true);

    try {
      const response = await fetch(`/api/users/${user?.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!response.ok) throw new Error("Failed to update password");
      toast.success("Your password was updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("We couldn’t update your password right now. Please try again.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your profile information</p>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
          Faculty Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="text-xs text-muted-foreground">Faculty ID</span>
            <p className="font-medium text-foreground font-mono">
              {user?.userId || user?.studentId || user?.id || "—"}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Full Name</span>
            <p className="font-medium text-foreground">{user?.firstName || user?.name || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Email</span>
            <p className="font-medium text-foreground">{user?.email || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Department</span>
            <p className="font-medium text-foreground">
              {user?.program || "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
          Change Password
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 max-w-md">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="new-password">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordError) setPasswordError("");
              }}
              placeholder="Enter new password"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="confirm-password">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordError) setPasswordError("");
              }}
              placeholder="Confirm password"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        {passwordError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {passwordError}
          </p>
        )}
        <div className="mt-4">
          <button
            onClick={handlePasswordChange}
            disabled={isSavingPassword || !newPassword || !confirmPassword}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Lock className="h-3.5 w-3.5" />
            {isSavingPassword ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
          Assigned Subject Offerings ({assignedOfferings.length})
        </h2>
        {assignedOfferings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subject offerings assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {assignedOfferings.map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-2">
                <BookOpen className="h-4 w-4 text-accent" />
                <div>
                  <p className="font-medium text-foreground">
                    {o.subjectCode} - {o.subjectTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.schedule} · {o.room}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}