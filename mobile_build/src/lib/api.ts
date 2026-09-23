import Constants from "expo-constants";
import { Platform } from "react-native";
import { getAuthToken } from "./storage";

// ---------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------
const configuredApiBase = String(
  Constants.expoConfig?.extra?.API_BASE ??
    process.env.EXPO_PUBLIC_API_BASE ??
    "http://localhost:4000",
);
const API_BASE = Platform.OS === "web"
  ? configuredApiBase.replace("http://10.0.2.2:4000", "http://localhost:4000")
  : configuredApiBase;
const REQUEST_TIMEOUT = 20000;

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const timeoutId = setTimeout(() => undefined, REQUEST_TIMEOUT);

  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string> ?? {}),
    };

    if (token) headers["Authorization"] = `Bearer ${token}`;

    let response: Response;
    try {
      response = await Promise.race([
        fetch(`${API_BASE}${path}`, { ...opts, headers }),
        new Promise<Response>((_, reject) => {
          setTimeout(() => reject(new Error(`Request timed out while contacting ${API_BASE}`)), REQUEST_TIMEOUT);
        }),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Request timed out")) throw error;
      throw new Error(`Unable to reach the backend at ${API_BASE}`);
    }

    if (!response.ok) {
      let payload: { error?: string } | null = null;
      try { payload = await response.json(); } catch { /* ignore */ }
      throw new Error(payload?.error ?? response.statusText);
    }

    if (response.status === 204) return undefined as unknown as T;
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------
// Types (new normalized schema)
// ---------------------------------------------------------------------
export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  id: string;
  role: string;
  email: string;
  firstName: string;
  lastName: string;
  program?: string;
  yearLevel?: string;
  semester?: string;
  academicYear?: string;
  studentId?: string;
}

export interface UserProfile {
  id: string;
  role: string;
  email: string;
  firstName: string;
  lastName: string;
  program?: string;
  yearLevel?: string;
  semester?: string;
  academicYear?: string;
  studentId?: string;
}

// Subject offering (from new schema)
export interface SubjectOffering {
  id: string;
  subjectId: string;
  academicYearId: string;
  semesterId: string;
  sectionId: string;
  facultyId?: string | null;
  schedule?: string;
  room?: string;
  capacity?: number | null;
  status: "active" | "inactive" | "closed";
  createdAt: number;
  subjectCode?: string;
  subjectTitle?: string;
  units?: number;
  academicYearCode?: string;
  semesterName?: string;
  sectionName?: string;
  yearLevel?: string;
  programName?: string;
  facultyName?: string;
}

export interface StudentRecord {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  program?: string;
  yearLevel?: string;
  semester?: string;
  academicYear?: string;
}

export interface AttendancePayload {
  studentId: string;
  subjectOfferingId: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  time?: string;
}

export interface AttendanceBulkPayload extends AttendancePayload {
  localId?: string;
}

export interface BulkAttendanceResult {
  localId?: string;
  id?: string;
  status: "created" | "updated" | "failed";
  error?: string;
}

// ---------------------------------------------------------------------
// API endpoints
// ---------------------------------------------------------------------
export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  return request<AuthResponse>("/api/users/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchUserProfile(): Promise<UserProfile> {
  return request<UserProfile>("/api/users/profile");
}

export async function fetchFacultyOfferings(): Promise<SubjectOffering[]> {
  return request<SubjectOffering[]>("/api/faculty/offerings");
}

export async function fetchOfferingStudents(offeringId: string): Promise<StudentRecord[]> {
  return request<StudentRecord[]>(
    `/api/faculty/subjects/${encodeURIComponent(offeringId)}/students`,
  );
}

export async function saveAttendance(attendance: AttendancePayload): Promise<AttendancePayload> {
  return request<AttendancePayload>("/api/attendance", {
    method: "POST",
    body: JSON.stringify(attendance),
  });
}

export async function saveAttendanceBulk(
  records: AttendanceBulkPayload[],
): Promise<BulkAttendanceResult[]> {
  return request<BulkAttendanceResult[]>("/api/attendance/bulk", {
    method: "POST",
    body: JSON.stringify({ records }),
  });
}

export interface AttendanceHistoryRecord {
  id: string;
  studentId: string;
  subjectOfferingId: string;
  date: string;
  time?: string;
  status: "present" | "absent" | "late" | "excused";
  updatedAt?: number;
  studentName?: string;
  subjectCode?: string;
  subjectTitle?: string;
  schedule?: string;
  room?: string;
  sectionName?: string;
}

export async function fetchAttendanceHistory(
  subjectOfferingId?: string,
): Promise<AttendanceHistoryRecord[]> {
  const query = subjectOfferingId
    ? `?subjectOfferingId=${encodeURIComponent(subjectOfferingId)}`
    : "";
  return request<AttendanceHistoryRecord[]>(`/api/attendance${query}`);
}