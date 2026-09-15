import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Clipboard, Plus, Search, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createUser,
  toggleUserStatus,
  updateUser,
  useUsers,
  type UserRole,
} from "@/lib/users-store";
import type { UserAccount } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin/users")({ component: UsersPage });

const roles: Array<{ value: UserRole | "all"; label: string }> = [
  { value: "all", label: "All roles" },
  { value: "student", label: "Students" },
  { value: "faculty", label: "Faculty" },
  { value: "registrar", label: "Registrars" },
  { value: "admin", label: "Administrators" },
];

function UsersPage() {
  const users = useUsers();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [status, setStatus] = useState<"all" | UserAccount["status"]>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    staffId?: string;
    studentId?: string;
    username: string;
    password: string;
    role: UserRole;
  } | null>(null);
  const [form, setForm] = useState({
    role: "student" as UserRole,
    firstName: "",
    lastName: "",
    email: "",
  });

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = role === "all" || user.role === role;
      const matchesStatus = status === "all" || user.status === status;
      const matchesSearch =
        !query ||
        [user.firstName, user.lastName, user.email, user.username, user.userId]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [role, search, status, users]);

  const submitUser = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required.");
      return;
    }
    setSaving(true);
    try {
      const created = await createUser({
        role: form.role,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
      });
      setForm({ role: "student", firstName: "", lastName: "", email: "" });
      setShowForm(false);
      setCreatedCredentials({
        staffId: created.role === "faculty" || created.role === "registrar" ? created.userId : undefined,
        studentId: created.studentId,
        username: created.username,
        password: created.temporaryPassword,
        role: created.role,
      });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to create user.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (user: UserAccount) => {
    try {
      await toggleUserStatus(user.id, user.status);
      toast.success(`${user.firstName} ${user.status === "active" ? "deactivated" : "activated"}.`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to change user status.");
    }
  };

  const editName = async (user: UserAccount) => {
    const firstName = window.prompt("First name", user.firstName);
    const lastName = window.prompt("Last name", user.lastName);
    if (!firstName?.trim() || !lastName?.trim()) return;
    try {
      await updateUser(user.id, { firstName: firstName.trim(), lastName: lastName.trim() });
      toast.success("User updated.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to update user.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage student, faculty, registrar, and administrator accounts.
          </p>
        </div>
        <Button onClick={() => setShowForm((current) => !current)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Add User"}
        </Button>
      </div>
      {showForm && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-heading text-sm font-semibold">Create User</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="First name"
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
            <input
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="Last name"
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
            {form.role === "student" && (
              <input
                className="rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            )}
            <select
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
            >
              {roles
                .filter((item) => item.value !== "all")
                .map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
            </select>
          </div>
          <Button className="mt-4" onClick={submitUser} disabled={saving}>
            {saving ? "Creating..." : "Create User"}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm"
            placeholder="Search users"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          aria-label="Filter by role"
          className="rounded-lg border bg-background px-3 py-2 text-sm"
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole | "all")}
        >
          {roles.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          aria-label="User status"
          className="rounded-lg border bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | UserAccount["status"])}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User information</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Account status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.studentId || (user.role === "faculty" || user.role === "registrar" ? user.userId : user.email || user.username)}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{user.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${user.status === "active" ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => editName(user)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => changeStatus(user)}>
                        {user.status === "active" ? (
                          <UserX className="mr-1 h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="mr-1 h-3.5 w-3.5" />
                        )}
                        {user.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No users match the current filters.
          </p>
        )}
      </div>
      <Dialog
        open={createdCredentials !== null}
        onOpenChange={(open) => !open && setCreatedCredentials(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Check className="h-5 w-5" />
              {createdCredentials?.role === "student"
                ? "Student"
                : createdCredentials?.role === "faculty"
                  ? "Faculty"
                  : "Staff"}{" "}
              Account Created Successfully!
            </DialogTitle>
            <DialogDescription>
              Please provide these login credentials to the{" "}
              {createdCredentials?.role === "faculty"
                ? "faculty member"
                : createdCredentials?.role === "registrar"
                  ? "staff member"
                  : "student"}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
            {createdCredentials?.studentId && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Student ID</span>
                <strong>{createdCredentials.studentId}</strong>
              </div>
            )}
            {createdCredentials?.staffId && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Staff ID</span>
                <strong>{createdCredentials.staffId}</strong>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Username</span>
              <strong>{createdCredentials?.username}</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Password</span>
              <strong>{createdCredentials?.password}</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Account Type</span>
              <strong className="capitalize">{createdCredentials?.role}</strong>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                if (!createdCredentials) return;
                try {
                  await navigator.clipboard.writeText(
                    `${createdCredentials.studentId ? `Student ID: ${createdCredentials.studentId}\n` : createdCredentials.staffId ? `Staff ID: ${createdCredentials.staffId}\n` : ""}Username: ${createdCredentials.username}\nPassword: ${createdCredentials.password}\nRole: ${createdCredentials.role}`,
                  );
                  toast.success("Credentials copied.");
                } catch {
                  toast.error("Unable to copy credentials.");
                }
              }}
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Copy Credentials
            </Button>
            <Button onClick={() => setCreatedCredentials(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
