import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, XCircle, Clock, Eye } from "lucide-react";
import {
  rejectRegistration,
  REGISTRATIONS_EVENT,
  type StudentRegistration,
} from "@/lib/registrations-store";
import { fetchStudents, updateStudent } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/registrar/registrations")({
  component: RegistrarRegistrations,
});

function RegistrarRegistrations() {
  const [list, setList] = useState<StudentRegistration[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "pending" | "approved" | "rejected">("pending");
  const [selectedReg, setSelectedReg] = useState<StudentRegistration | null>(null);
  const [rejectingReg, setRejectingReg] = useState<StudentRegistration | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  const refresh = async () => {
    try {
      const registrations = await fetchStudents();
      setList(registrations);
    } catch {
      setList([]);
    }
  };

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(REGISTRATIONS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(REGISTRATIONS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const isPendingStatus = (status: string) =>
    ["pending", "submitted", "under_review", "in_progress", "not_started"].includes(status);

  const filtered = list.filter((r) => {
    const q = search.toLowerCase();
    const programName = r.program?.toLowerCase() ?? "";
    const matchSearch =
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      programName.includes(q) ||
      r.studentId.toLowerCase().includes(q);
    const matchStatus =
      filter === "All" || (filter === "pending" ? isPendingStatus(r.status) : r.status === filter);
    return matchSearch && matchStatus;
  });

  const counts = {
    pending: list.filter((r) => isPendingStatus(r.status)).length,
    approved: list.filter((r) => r.status === "approved").length,
    rejected: list.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Student Applications</h1>
          <p className="text-sm text-muted-foreground">
            Monitor incoming student registrations, verify records, and manage application status.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Pending", count: counts.pending, color: "text-warning", icon: Clock },
            { label: "Approved", count: counts.approved, color: "text-success", icon: XCircle },
            { label: "Rejected", count: counts.rejected, color: "text-destructive", icon: XCircle },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${s.color}`}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className={`font-heading text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-50 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, program, or ID..."
            className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex gap-1">
          {(["All", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === s ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Full Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Program</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Year Level</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Semester</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Submission Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.studentId}</td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {r.firstName} {r.middleName ? `${r.middleName} ` : ""}
                  {r.lastName}
                  {r.suffix ? ` ${r.suffix}` : ""}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.program}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.yearLevel}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.semester || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${r.status === "approved" ? "bg-success/10 text-success" : r.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedReg(r)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                      aria-label={`View application for ${r.firstName} ${r.lastName}`}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    {isPendingStatus(r.status) && (
                      <button
                        onClick={() => {
                          setRejectingReg(r);
                          setRejectionReason("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No applications found in this view
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedReg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedReg(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
              Application Details
            </h2>
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Student ID</p>
                  <p className="font-medium text-foreground">{selectedReg.studentId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground capitalize">{selectedReg.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Full Name</p>
                  <p className="font-medium text-foreground">
                    {selectedReg.firstName}{" "}
                    {selectedReg.middleName ? `${selectedReg.middleName} ` : ""}
                    {selectedReg.lastName}
                    {selectedReg.suffix ? ` ${selectedReg.suffix}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{selectedReg.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Program</p>
                  <p className="font-medium text-foreground">{selectedReg.program}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Year Level</p>
                  <p className="font-medium text-foreground">{selectedReg.yearLevel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Semester</p>
                  <p className="font-medium text-foreground">{selectedReg.semester || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="font-medium text-foreground">{selectedReg.contactNumber}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium text-foreground">{selectedReg.address || "—"}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedReg(null)}
                className="rounded-lg border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {rejectingReg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setRejectingReg(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 font-heading text-lg font-bold text-foreground">
              Reject Application
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Provide a short reason for rejecting {rejectingReg.firstName} {rejectingReg.lastName}.
              This message will be saved with the application status.
            </p>
            <label
              className="mb-2 block text-sm font-medium text-foreground"
              htmlFor="rejection-reason"
            >
              Reason (optional)
            </label>
            <textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Enter a rejection note..."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingReg(null);
                  setRejectionReason("");
                }}
                className="rounded-lg border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRejection}
                onClick={async () => {
                  try {
                    setIsSubmittingRejection(true);
                    await rejectRegistration(rejectingReg.id, rejectionReason.trim() || undefined);
                    toast.success("Application rejected");
                    setRejectingReg(null);
                    setRejectionReason("");
                    await refresh();
                  } finally {
                    setIsSubmittingRejection(false);
                  }
                }}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {isSubmittingRejection ? "Submitting..." : "Reject Application"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}