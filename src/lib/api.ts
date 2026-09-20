const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const REQUEST_TIMEOUT = 15000;

async function request<T>(path: string, opts: RequestInit = {}, authToken?: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const storedSession =
      typeof window !== "undefined" ? window.localStorage.getItem("piat-auth-user") : null;
    const authUser = storedSession ? JSON.parse(storedSession) : null;
    let headers: HeadersInit = { "Content-Type": "application/json" };
    if (opts.headers) {
      if (opts.headers instanceof Headers) {
        opts.headers.forEach((value, key) => {
          (headers as Record<string, string>)[key] = value;
        });
      } else if (Array.isArray(opts.headers)) {
        for (const [key, value] of opts.headers) {
          (headers as Record<string, string>)[key] = value;
        }
      } else {
        headers = {
          ...(headers as Record<string, string>),
          ...(opts.headers as Record<string, string>),
        };
      }
    }

    const token = authToken ?? authUser?.token;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (authUser?.role) {
      headers["x-user-role"] = authUser.role;
    }
    if (authUser?.id) {
      headers["x-user-id"] = authUser.id;
    }
    if (authUser?.studentId) {
      headers["x-user-student-id"] = authUser.studentId;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      headers,
      ...opts,
      signal: controller.signal,
    });

    if (!response.ok) {
      let payload: { error?: string } | null = null;
      try {
        payload = await response.json();
      } catch {
        // ignore parse errors
      }
      throw new Error(payload?.error ?? response.statusText);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestAllPages<T>(path: string, params: URLSearchParams): Promise<T[]> {
  params.set("page", "1");
  params.set("limit", "100");
  const firstPage = await request<{ data: T[]; totalPages: number }>(`${path}?${params}`);
  if (firstPage.totalPages <= 1) return firstPage.data;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) => {
      const pageParams = new URLSearchParams(params);
      pageParams.set("page", String(index + 2));
      return request<{ data: T[] }>(`${path}?${pageParams}`);
    }),
  );
  return [firstPage.data, ...remainingPages.map((page) => page.data)].flat();
}

// ---------- NEW: Subject Offerings ----------
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
  // joined fields (from API)
  subjectCode?: string;
  subjectTitle?: string;
  units?: number;
  academicYearCode?: string;
  academicYearName?: string;
  semesterName?: string;
  semesterSequence?: number;
  sectionName?: string;
  yearLevel?: string;
  programName?: string;
  facultyName?: string;
}

export async function fetchSubjectOfferings(filters?: {
  academicYear?: string;
  semester?: string;
  sectionId?: string;
  facultyId?: string;
  subjectId?: string;
}): Promise<SubjectOffering[]> {
  const params = new URLSearchParams();
  if (filters?.academicYear) params.set("academicYear", filters.academicYear);
  if (filters?.semester) params.set("semester", filters.semester);
  if (filters?.sectionId) params.set("sectionId", filters.sectionId);
  if (filters?.facultyId) params.set("facultyId", filters.facultyId);
  if (filters?.subjectId) params.set("subjectId", filters.subjectId);
  return requestAllPages<SubjectOffering>("/api/subject-offerings", params);
}

export async function createSubjectOffering(offering: {
  subjectId: string;
  academicYearId: string;
  semesterId: string;
  sectionId?: string | null;
  facultyId?: string;
  schedule?: string;
  room?: string;
  capacity?: number;
}): Promise<SubjectOffering> {
  return request<SubjectOffering>("/api/subject-offerings", {
    method: "POST",
    body: JSON.stringify(offering),
  });
}

export async function updateSubjectOffering(
  id: string,
  patch: Partial<{
    facultyId: string | null;
    schedule: string | null;
    room: string | null;
    capacity: number | null;
    status: string;
  }>,
): Promise<SubjectOffering> {
  return request<SubjectOffering>(`/api/subject-offerings/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function assignSubjectOfferings(
  facultyId: string,
  offeringIds: string[],
): Promise<{ assignedCount: number; alreadyAssignedCount: number; skippedCount: number; totalAssigned: number }> {
  return request<{ assignedCount: number; alreadyAssignedCount: number; skippedCount: number; totalAssigned: number }>(
    "/api/subject-offerings/assign",
    {
      method: "POST",
      body: JSON.stringify({ facultyId, offeringIds }),
    },
  );
}

export async function deleteSubjectOffering(id: string): Promise<void> {
  return request<void>(`/api/subject-offerings/${id}`, {
    method: "DELETE",
  });
}

// ---------- SUBJECTS (global) ----------
export interface Subject {
  id: string;
  code: string;
  title: string;
  units: number;
  description?: string | null;
}

export async function fetchSubjects(): Promise<Subject[]> {
  const response = await request<{ data: Subject[] }>("/api/subjects");
  return response.data;
}

export async function createSubject(subject: {
  code: string;
  title: string;
  units: number;
  description?: string;
}): Promise<Subject> {
  return request<Subject>("/api/subjects", {
    method: "POST",
    body: JSON.stringify(subject),
  });
}

export async function updateSubjectApi(id: string, patch: Partial<Subject>): Promise<Subject> {
  return request<Subject>(`/api/subjects/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function deleteSubjectApi(id: string): Promise<void> {
  return request<void>(`/api/subjects/${id}`, {
    method: "DELETE",
  });
}

// ---------- STUDENTS ----------
export interface StudentRegistration {
  id: string;
  studentId: string;
  firstName: string;
  middleName?: string | null;
  suffix?: string | null;
  lastName: string;
  email: string;
  password: string; // hashed
  gender?: string | null;
  dob?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  religion?: string | null;
  educationLevel: "JHS" | "SHS" | "College";
  previousSchool?: string | null;
  lastGrade?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  region?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  fatherName?: string | null;
  fatherOccupation?: string | null;
  fatherContact?: string | null;
  motherName?: string | null;
  motherOccupation?: string | null;
  motherContact?: string | null;
  guardianName?: string | null;
  guardianOccupation?: string | null;
  guardianContact?: string | null;
  guardianRelation?: string | null;
  parentName?: string | null;
  parentContact?: string | null;
  parentAddress?: string | null;
  emergencyName?: string | null;
  emergencyContact?: string | null;
  emergencyAddress?: string | null;
  emergencyRelation?: string | null;
  placeOfBirth?: string | null;
  barangay?: string | null;
  parentRelationship?: string | null;
  program?: string;
  yearLevel?: string;
  semester?: string;
  academicYear?: string;
  section?: string;
  sectionId?: string;
  status:
    | "not_started"
    | "in_progress"
    | "submitted"
    | "under_review"
    | "pending"
    | "approved"
    | "rejected"
    | "active"
    | "inactive"
    | "graduated"
    | "transferred";
  submittedAt: number;
  reviewedAt?: number | null;
  reviewNote?: string | null;
  firstLoginAt?: number | null;
  lastLoginAt?: number | null;
}

export type Student = StudentRegistration;

export interface StudentRegistrationPayload {
  firstName: string;
  middleName?: string | null;
  suffix?: string | null;
  lastName: string;
  email: string;
  password: string;
  gender?: string | null;
  dob?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  religion?: string | null;
  educationLevel: "JHS" | "SHS" | "College";
  previousSchool?: string | null;
  lastGrade?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  region?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  fatherName?: string | null;
  fatherOccupation?: string | null;
  fatherContact?: string | null;
  motherName?: string | null;
  motherOccupation?: string | null;
  motherContact?: string | null;
  guardianName?: string | null;
  guardianOccupation?: string | null;
  guardianContact?: string | null;
  guardianRelation?: string | null;
  parentName?: string | null;
  parentContact?: string | null;
  parentAddress?: string | null;
  emergencyName?: string | null;
  emergencyContact?: string | null;
  emergencyAddress?: string | null;
  emergencyRelation?: string | null;
  placeOfBirth?: string | null;
  barangay?: string | null;
  parentRelationship?: string | null;
  status?: string;
  // For auto-enrollment (these are not stored on student, but used to enroll)
  program?: string;
  yearLevel?: string;
  semester?: string;
  academicYear?: string;
}

export async function fetchStudents(status?: string): Promise<StudentRegistration[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await request<{ data: StudentRegistration[] }>(`/api/students${query}`);
  return response.data;
}

export async function fetchStudentById(studentId: string, authToken?: string): Promise<StudentRegistration> {
  return request<StudentRegistration>(`/api/students/${encodeURIComponent(studentId)}`, {}, authToken);
}

export async function createStudent(student: StudentRegistrationPayload): Promise<StudentRegistration> {
  return request<StudentRegistration>("/api/students", {
    method: "POST",
    body: JSON.stringify(student),
  });
}

export async function updateStudent(
  studentId: string,
  patch: Partial<StudentRegistrationPayload & { status?: string; reviewedAt?: string; reviewNote?: string }>,
): Promise<StudentRegistration> {
  return request<StudentRegistration>(`/api/students/${encodeURIComponent(studentId)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export type StudentLoginResponse = StudentRegistration & { token?: string };

export async function loginStudent(email: string, password: string): Promise<StudentLoginResponse> {
  return request<StudentLoginResponse>("/api/students/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ---------- USERS ----------
export interface UserAccount {
  id: string;
  facultyId?: string;
  userId: string;
    staffId?: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: "admin" | "faculty" | "registrar" | "student";
  status: "active" | "inactive";
  createdAt: number;
  temporaryPassword?: string;
  studentId?: string;
  token?: string;
  program?: string;
  yearLevel?: string;
  semester?: string;
  academicYear?: string;
  firstLoginAt?: number | null;
  lastLoginAt?: number | null;
}

export async function fetchUsers(role?: string): Promise<UserAccount[]> {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  const response = await request<{ data: UserAccount[] }>(`/api/users${query}`);
  return response.data;
}

export async function createUser(user: {
  role: string;
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
}): Promise<UserAccount> {
  return request<UserAccount>("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
}

export async function loginUser(email: string, password: string): Promise<UserAccount | null> {
  try {
    return await request<UserAccount>("/api/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return null;
  }
}

// ---------- ENROLLMENTS (now using subjectOfferingId) ----------
export interface StudentEnrollment {
  id: string;
  studentId: string;        // UUID (internal)
  subjectOfferingId: string;
  status: "enrolled" | "dropped" | "completed";
  enrolledAt: number;
  // Denormalized fields for convenience (from offering)
  subjectCode?: string;
  subjectTitle?: string;
  units?: number;
  academicYear?: string;
  academicYearCode?: string;
  semester?: string;
  semesterName?: string;
  yearLevel?: string;
  sectionName?: string;
  facultyName?: string;
  schedule?: string;
  room?: string;
}

export async function fetchEnrollments(
  studentIdOrFilters?: string | { studentId?: string; offeringId?: string; status?: string },
  offeringId?: string,
  status?: string,
): Promise<StudentEnrollment[]> {
  const params = new URLSearchParams();
  const studentId =
    typeof studentIdOrFilters === "string"
      ? studentIdOrFilters
      : studentIdOrFilters?.studentId ?? undefined;
  const resolvedOfferingId =
    typeof studentIdOrFilters === "string"
      ? offeringId
      : studentIdOrFilters?.offeringId ?? offeringId;
  const resolvedStatus =
    typeof studentIdOrFilters === "string" ? status : studentIdOrFilters?.status ?? status;

  if (studentId) params.set("studentId", studentId);
  if (resolvedOfferingId) params.set("offeringId", resolvedOfferingId);
  if (resolvedStatus) params.set("status", resolvedStatus);
  return requestAllPages<StudentEnrollment>("/api/enrollments", params);
}

export async function createEnrollments(data: {
  studentId: string;        // human-readable studentId
  offeringIds: string[];    // array of subjectOffering UUIDs
}): Promise<StudentEnrollment[]> {
  return request<StudentEnrollment[]>("/api/enrollments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---------- GRADES (using subjectOfferingId) ----------
export interface GradeEntry {
  id: string;
  studentId: string;        // UUID
  subjectOfferingId: string;
  grade: number;
  remarks?: string;
  submittedAt: number;
  period?: "prelim" | "midterm" | "final" | "overall";
  type?: "activity" | "quiz" | "exam" | "overall";
  component?: string;
  status?: "draft" | "submitted" | "finalized";
  // Denormalized
  subjectCode?: string;
  subjectTitle?: string;
  studentFirstName?: string;
  studentLastName?: string;
  studentName?: string;
}

export async function fetchGrades(
  offeringIdOrFilters?: string | { offeringId?: string; studentId?: string },
  studentId?: string,
): Promise<GradeEntry[]> {
  const params = new URLSearchParams();
  const offeringId =
    typeof offeringIdOrFilters === "string" ? offeringIdOrFilters : offeringIdOrFilters?.offeringId;
  const resolvedStudentId =
    typeof offeringIdOrFilters === "string" ? studentId : offeringIdOrFilters?.studentId ?? studentId;

  if (offeringId) params.set("subjectOfferingId", offeringId);
  if (resolvedStudentId) params.set("studentId", resolvedStudentId);
  return requestAllPages<GradeEntry>("/api/grades", params);
}

export async function saveGrade(grade: {
  studentId: string;          // human-readable studentId
  subjectOfferingId: string;
  grade: number;
  remarks?: string;
  period?: "prelim" | "midterm" | "final" | "overall";
  type?: "activity" | "quiz" | "exam" | "overall";
  component?: string;
  status?: "draft" | "submitted" | "finalized";
}): Promise<GradeEntry> {
  return request<GradeEntry>("/api/grades", {
    method: "POST",
    body: JSON.stringify(grade),
  });
}

export async function deleteGradeApi(studentId: string, offeringId: string): Promise<void> {
  return request<void>(
    `/api/grades?studentId=${encodeURIComponent(studentId)}&subjectOfferingId=${encodeURIComponent(offeringId)}`,
    { method: "DELETE" },
  );
}

// ---------- ATTENDANCE (using subjectOfferingId) ----------
export interface AttendanceRecord {
  id: string;
  studentId: string;        // UUID
  subjectOfferingId: string;
  date: string;
  time?: string;
  status: "present" | "absent" | "late" | "excused";
  updatedAt: number;
}

export async function fetchAttendanceRecords(filters?: {
  offeringId?: string;
  date?: string;
  studentId?: string;
}): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams();
  if (filters?.offeringId) params.set("subjectOfferingId", filters.offeringId);
  if (filters?.date) params.set("date", filters.date);
  if (filters?.studentId) params.set("studentId", filters.studentId);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<AttendanceRecord[]>(`/api/attendance${query}`);
}

export async function saveAttendance(attendance: {
  studentId: string;      // human-readable
  subjectOfferingId: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  time?: string;
}): Promise<AttendanceRecord> {
  return request<AttendanceRecord>("/api/attendance", {
    method: "POST",
    body: JSON.stringify(attendance),
  });
}

export async function saveAttendanceRecord(attendance: {
  studentId: string;
  offeringId: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  time?: string;
}): Promise<AttendanceRecord> {
  return saveAttendance({
    studentId: attendance.studentId,
    subjectOfferingId: attendance.offeringId,
    date: attendance.date,
    status: attendance.status,
    time: attendance.time,
  });
}

export async function enrollStudent(
  studentId: string,
  offeringIds: string[],
): Promise<StudentEnrollment[]> {
  return createEnrollments({ studentId, offeringIds });
}

export async function addOrUpdateGrade(
  studentId: string,
  subjectOfferingId: string,
  grade: number,
  remarks?: string,
  period?: "prelim" | "midterm" | "final" | "overall",
  type?: "activity" | "quiz" | "exam" | "overall",
  component?: string,
  status?: GradeEntry["status"],
): Promise<GradeEntry> {
  return saveGrade({
    studentId,
    subjectOfferingId,
    grade,
    remarks,
    period,
    type,
    component,
    status,
  });
}

// ---------- ACADEMIC STRUCTURE ----------
export interface AcademicStructure {
  academicYears: string[];
  yearLevels: string[];
  semesters: string[];
}

export async function fetchAcademicStructure(): Promise<AcademicStructure> {
  const response = await request<{
    years?: Array<{ code?: string; name?: string }>;
    academicYears?: string[];
    yearLevels?: string[];
    semesters?: Array<{ name?: string }> | string[];
  }>("/api/meta/academic-structure");

  return {
    academicYears:
      response.academicYears ??
      (response.years ?? []).map((year) => year.code || year.name || "").filter(Boolean),
    yearLevels: response.yearLevels ?? [],
    semesters: (response.semesters ?? [])
      .map((semester) => (typeof semester === "string" ? semester : semester.name || ""))
      .filter(Boolean),
  };
}

// ---------- PROGRAMS ----------
export interface Program {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export async function fetchPrograms(): Promise<string[]> {
  return request<string[]>("/api/programs");
}

export async function fetchProgramsDetailed(): Promise<Program[]> {
  return request<Program[]>("/api/programs/detailed");
}

export async function createProgram(program: { name: string; description?: string }): Promise<Program> {
  return request<Program>("/api/programs", {
    method: "POST",
    body: JSON.stringify(program),
  });
}

export async function updateProgramApi(id: string, program: Partial<{ name: string; description: string }>): Promise<Program> {
  return request<Program>(`/api/programs/${id}`, {
    method: "PUT",
    body: JSON.stringify(program),
  });
}

export async function deleteProgramApi(id: string): Promise<void> {
  return request<void>(`/api/programs/${id}`, {
    method: "DELETE",
  });
}

// ---------- CURRICULUM ----------
export interface CurriculumItem {
  id: string;
  programId: string;
  programName?: string;
  yearLevel: string;
  semester: string;
  subjectId: string;
  subjectCode?: string;
  subjectTitle?: string;
  units?: number;
}

export async function fetchCurriculum(filters?: {
  programId?: string;
  program?: string;
  yearLevel?: string;
  semester?: string;
}): Promise<CurriculumItem[]> {
  const params = new URLSearchParams();
  if (filters?.programId) params.set("programId", filters.programId);
  if (filters?.program) params.set("program", filters.program);
  if (filters?.yearLevel) params.set("yearLevel", filters.yearLevel);
  if (filters?.semester) params.set("semester", filters.semester);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<CurriculumItem[]>(`/api/curriculum${query}`);
}

export async function createCurriculumItem(item: {
  programId: string;
  yearLevel: string;
  semester: string;
  subjectId: string;
}): Promise<CurriculumItem> {
  return request<CurriculumItem>("/api/curriculum", {
    method: "POST",
    body: JSON.stringify(item),
  });
}

export async function deleteCurriculumItem(id: string): Promise<void> {
  return request<void>(`/api/curriculum/${id}`, {
    method: "DELETE",
  });
}

// ---------- SECTIONS ----------
export interface Section {
  id: string;
  code: string;
  name: string;
  programId: string;
  yearLevel: string;
  semesterId: string;
  academicYearId: string;
  capacity?: number | null;
  status: "active" | "inactive";
  createdAt: number;
  programName?: string;
  semesterName?: string;
  academicYear?: string;
}

export async function fetchSections(): Promise<Section[]> {
  const response = await request<{ data: Section[] }>("/api/sections");
  return response.data;
}

export async function createSection(section: {
  code: string;
  name: string;
  programId: string;
  yearLevel: string;
  semesterId: string;
  academicYearId: string;
  capacity?: number;
}): Promise<Section> {
  return request<Section>("/api/sections", {
    method: "POST",
    body: JSON.stringify(section),
  });
}

// ---------- RE-ENROLLMENT ----------
export async function fetchEligibleReenrollments(): Promise<{ studentId: string }[]> {
  return request<{ studentId: string }[]>("/api/students/eligible-for-reenrollment");
}

export async function reenrollStudent(
  studentId: string,
  data: { nextSemester?: string; nextYear?: string; nextAcademicYear?: string },
): Promise<any> {
  return request<any>(`/api/students/${encodeURIComponent(studentId)}/reenroll`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---------- RECORDS FINALIZATION ----------
export async function finalizeStudentRecords(
  studentId: string,
  data?: { period?: string; subjectOfferingId?: string; academicYear?: string; semester?: string },
): Promise<any> {
  return request<any>(`/api/students/${encodeURIComponent(studentId)}/finalize-records`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
}

// ---------- ANNOUNCEMENTS ----------
export interface Announcement {
  id: string;
  title: string;
  body: string;
  category?: string;
  audience?: string;
  subjectId?: string | null;
  pinned?: boolean | number;
  authorName?: string;
  authorRole?: string;
  createdAt: number;
  datePosted?: string;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const response = await request<Announcement[] | { data: Announcement[] }>("/api/announcements");
  return Array.isArray(response) ? response : response.data;
}

export async function createAnnouncement(announcement: {
  title: string;
  body: string;
  category: string;
  audience: string;
  authorName: string;
  authorRole: string;
}): Promise<any> {
  return request<any>("/api/announcements", {
    method: "POST",
    body: JSON.stringify(announcement),
  });
}

export async function updateAnnouncement(
  id: string,
  announcement: { title: string; body: string; category: string; audience: string },
): Promise<Announcement> {
  return request<Announcement>(`/api/announcements/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(announcement),
  });
}

export async function deleteAnnouncementApi(id: string): Promise<void> {
  return request<void>(`/api/announcements?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ---------- NOTIFICATIONS ----------
export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  relatedId?: string | null;
}

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  const response = await request<NotificationItem[] | { data: NotificationItem[] }>(
    `/api/notifications?userId=${encodeURIComponent(userId)}`,
  );
  return Array.isArray(response) ? response : response.data;
}

// ---------- DASHBOARD STATS ----------
export interface RegistrarDashboardStats {
  pendingApplications: number;
  approvedStudents: number;
  pendingEnrollments: number;
  activeStudents: number;
  totalSubjects: number;
  assignedFaculty: number;
  programsOffered: number;
  eligibleReenrollment: number;
  recentActivities: { type: string; message: string; date: string }[];
}

export async function fetchRegistrarDashboardStats(): Promise<RegistrarDashboardStats> {
  return request<RegistrarDashboardStats>("/api/dashboard/registrar");
}

export interface AdminDashboardStats {
  totalStudents: number;
  activeFaculty: number;
  activeOfferings: number;
  pendingApplications: number;
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  return request<AdminDashboardStats>("/api/dashboard/admin");
}

export async function updateUserApi(
  id: string,
  patch: { firstName: string; middleName?: string | null; lastName: string; email: string },
): Promise<UserAccount> {
  return request<UserAccount>(`/api/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

// ---------- REPORTS ----------
export async function fetchReportEnrollment(): Promise<any> {
  return request<any>("/api/reports/enrollment");
}

export async function fetchReportFacultyLoad(): Promise<any[]> {
  return request<any[]>("/api/reports/faculty-load");
}

export async function fetchReportStudents(): Promise<any[]> {
  const response = await request<{ data: any[] }>("/api/reports/students");
  return response.data;
}

export async function fetchReportCurriculum(): Promise<any[]> {
  return request<any[]>("/api/reports/curriculum");
}

// ---------- SETTINGS ----------
export async function fetchSettings(): Promise<Record<string, string | boolean>> {
  return request<Record<string, string | boolean>>("/api/settings");
}

export async function saveSettings(settings: Record<string, string | boolean>): Promise<{ success: true }> {
  return request<{ success: true }>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

// ---------- ACTIVITY LOGS ----------
export interface ActivityLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  details: string;
  role: string;
  createdAt: string;
}

export async function fetchActivityLogs(): Promise<ActivityLogEntry[]> {
  const response = await request<ActivityLogEntry[] | { data?: ActivityLogEntry[] }>(
    "/api/activity-logs",
  );
  return Array.isArray(response) ? response : response.data ?? [];
}

// ---------- CLEARANCE (stubs) ----------
export async function fetchAccounts(): Promise<any[]> {
  return request<any[]>("/api/finance/accounts");
}

export async function fetchClearances(): Promise<any[]> {
  return request<any[]>("/api/clearances");
}

export async function issueClearance(accountId: string, issuedBy: string, semester: string): Promise<any> {
  return request<any>(`/api/clearances/issue`, {
    method: "POST",
    body: JSON.stringify({ accountId, issuedBy, semester }),
  });
}

export async function markAccountPaid(accountId: string): Promise<any> {
  return request<any>(`/api/finance/accounts/${encodeURIComponent(accountId)}/mark-paid`, {
    method: "POST",
  });
}

export async function revokeClearance(id: string): Promise<any> {
  return request<any>(`/api/clearances/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
  });
}