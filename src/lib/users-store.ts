import { useEffect, useState, useCallback } from "react";
import {
  fetchUsers,
  fetchActivityLogs,
  createUser as apiCreateUser,
  updateUserApi,
  type ActivityLogEntry,
} from "./api";

export type UserRole = "admin" | "faculty" | "registrar" | "student";

export interface UserAccount {
  id: string;
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  studentId?: string;
  middleName?: string | null;
  role: UserRole;
  status: "active" | "inactive";
  program?: string;
  yearLevel?: string;
  semester?: string;
  academicYear?: string;
  createdAt: number;
  temporaryPassword?: string;
}

export interface CreateUserPayload {
  role: UserRole;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
  gender?: string | null;
  email?: string;
  password?: string;
  program?: string;
  yearLevel?: string;
  semester?: string;
  academicYear?: string;
}

const EVENT = "bwest:users-changed";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function broadcastUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function generateUsername(firstName: string, lastName: string, role: UserRole): string {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "");
  if (role === "faculty" || role === "registrar") return `${cleanFirst}.${cleanLast}@piat.edu.ph`;
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const rolePrefix = role === "admin" ? "admin" : "user";
  return `${rolePrefix}${cleanFirst.charAt(0)}${cleanLast}${randomNum}`;
}

export function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<UserAccount & { temporaryPassword: string }> {
  const user = await apiCreateUser(payload);
  broadcastUpdate();
  return { ...user, temporaryPassword: user.temporaryPassword || "" };
}

export function useActivityLogs() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);

  const refresh = useCallback(async () => {
    try {
      setLogs(await fetchActivityLogs());
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [refresh]);

  return logs;
}

export async function updateUser(id: string, patch: Partial<UserAccount>) {
  await updateUserApi(id, {
    firstName: patch.firstName || "",
    middleName: patch.middleName,
    lastName: patch.lastName || "",
    email: patch.email || "",
  });
  broadcastUpdate();
}

export async function resetUserPassword(id: string): Promise<string> {
  const newPassword = generateTemporaryPassword();
  const response = await fetch(`${API_BASE}/api/users/${id}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!response.ok) throw new Error("Failed to reset password");
  broadcastUpdate();
  return newPassword;
}

export async function toggleUserStatus(id: string, currentStatus?: string) {
  const newStatus = currentStatus === "active" ? "inactive" : "active";
  await fetch(`${API_BASE}/api/users/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus }),
  });
  broadcastUpdate();
}

export function useUsers() {
  const [users, setUsers] = useState<UserAccount[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => {
      refresh();
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [refresh]);

  return users;
}

export function useUsersByRole(role: UserRole) {
  const [users, setUsers] = useState<UserAccount[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchUsers(role);
      setUsers(data);
    } catch {
      setUsers([]);
    }
  }, [role]);

  useEffect(() => {
    refresh();
    const onChange = () => {
      refresh();
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [refresh]);

  return users;
}
