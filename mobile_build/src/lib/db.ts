import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

const DB_NAME = "piat_mobile.db";
const isWeb = Platform.OS === "web";
const db: any = isWeb ? null : SQLite.openDatabaseSync(DB_NAME);
const webOfferings = new Map<string, Record<string, any>>();
const webStudents = new Map<string, any>();
const webOfferingStudents = new Map<string, Set<string>>();
const webAttendance = new Map<string, AttendanceRecord>();
const validAttendanceStatuses = new Set(["present", "late", "absent", "excused"]);
let initialization: Promise<void> | null = null;

// ---------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------
async function initializeDb() {
  if (isWeb) return;
  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS faculty (
      id TEXT PRIMARY KEY,
      email TEXT,
      firstName TEXT,
      lastName TEXT,
      role TEXT,
      program TEXT,
      yearLevel TEXT,
      semester TEXT,
      academicYear TEXT
    );

    CREATE TABLE IF NOT EXISTS offerings (
      id TEXT PRIMARY KEY,
      subjectId TEXT,
      subjectCode TEXT,
      subjectTitle TEXT,
      units INTEGER,
      schedule TEXT,
      room TEXT,
      facultyId TEXT,
      academicYearCode TEXT,
      semesterName TEXT,
      yearLevel TEXT,
      programName TEXT,
      sectionName TEXT,
      enrolledStudentCount INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      studentId TEXT UNIQUE,
      firstName TEXT,
      lastName TEXT,
      program TEXT,
      yearLevel TEXT,
      semester TEXT,
      academicYear TEXT
    );

    CREATE TABLE IF NOT EXISTS offering_students (
      offeringId TEXT NOT NULL,
      studentId TEXT NOT NULL,
      PRIMARY KEY (offeringId, studentId)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      studentName TEXT NOT NULL,
      offeringId TEXT NOT NULL,
      subjectCode TEXT NOT NULL,
      subjectName TEXT NOT NULL,
      facultyId TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      academicYear TEXT NOT NULL,
      semester TEXT NOT NULL,
      status TEXT NOT NULL,
      syncStatus TEXT NOT NULL,
      serverId TEXT,
      retryCount INTEGER NOT NULL DEFAULT 0,
      nextRetryAt INTEGER,
      lastAttemptAt INTEGER,
      lastSyncAt INTEGER,
      lastError TEXT,
      retryable INTEGER NOT NULL DEFAULT 1,
      updatedAt INTEGER NOT NULL,
      UNIQUE(studentId, offeringId, date)
    );
  `);

  const attendanceColumns = (await db.getAllAsync(`PRAGMA table_info(attendance)`)) as Array<{ name: string }>;
  const attendanceColumnNames = new Set(attendanceColumns.map((column) => column.name));
  const attendanceMigrations: Array<[string, string]> = [
    ["serverId", "TEXT"],
    ["retryCount", "INTEGER NOT NULL DEFAULT 0"],
    ["nextRetryAt", "INTEGER"],
    ["lastAttemptAt", "INTEGER"],
    ["lastSyncAt", "INTEGER"],
    ["lastError", "TEXT"],
    ["retryable", "INTEGER NOT NULL DEFAULT 1"],
  ];
  for (const [name, definition] of attendanceMigrations) {
    if (!attendanceColumnNames.has(name)) {
      await db.execAsync(`ALTER TABLE attendance ADD COLUMN ${name} ${definition}`);
    }
  }
  await db.runAsync(
    `UPDATE attendance SET syncStatus = 'pending' WHERE syncStatus = 'syncing'`,
  );

  const offeringColumns = (await db.getAllAsync(`PRAGMA table_info(offerings)`)) as Array<{ name: string }>;
  if (!offeringColumns.some((column) => column.name === "enrolledStudentCount")) {
    await db.execAsync(`ALTER TABLE offerings ADD COLUMN enrolledStudentCount INTEGER NOT NULL DEFAULT 0`);
  }
}

export function initDb(): Promise<void> {
  initialization ??= initializeDb();
  return initialization;
}

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
export type AttendanceSyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  offeringId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  date: string;
  time: string;
  academicYear: string;
  semester: string;
  status: string;
  syncStatus: AttendanceSyncStatus;
  serverId?: string | null;
  retryCount?: number;
  nextRetryAt?: number | null;
  lastAttemptAt?: number | null;
  lastSyncAt?: number | null;
  lastError?: string | null;
  retryable?: boolean | number;
  updatedAt: number;
}

export interface AttendanceSaveResult extends AttendanceRecord {
  isUpdated: boolean;
  previousStatus: string | null;
}

export interface AttendanceSyncSummary {
  pendingCount: number;
  syncingCount: number;
  syncedCount: number;
  failedCount: number;
  retryableFailedCount: number;
  lastSyncAt: number | null;
}

// ---------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------
export async function upsertFaculty(faculty: Record<string, string | null>) {
  if (isWeb) return;
  await initDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO faculty (id, email, firstName, lastName, role, program, yearLevel, semester, academicYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      faculty.id,
      faculty.email,
      faculty.firstName,
      faculty.lastName,
      faculty.role,
      faculty.program,
      faculty.yearLevel,
      faculty.semester,
      faculty.academicYear,
    ],
  );
}

export async function upsertOfferings(offerings: Array<Record<string, any>>) {
  if (isWeb) {
    offerings.forEach((offering) => webOfferings.set(offering.id, { ...offering }));
    return;
  }
  await initDb();
  await Promise.all(
    offerings.map((offering) =>
      db.runAsync(
        `INSERT OR REPLACE INTO offerings (id, subjectId, subjectCode, subjectTitle, units, schedule, room, facultyId, academicYearCode, semesterName, yearLevel, programName, sectionName, enrolledStudentCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          offering.id,
          offering.subjectId,
          offering.subjectCode,
          offering.subjectTitle,
          offering.units,
          offering.schedule,
          offering.room,
          offering.facultyId,
          offering.academicYearCode,
          offering.semesterName,
          offering.yearLevel,
          offering.programName,
          offering.sectionName,
          offering.enrolledStudentCount ?? 0,
        ],
      ),
    ),
  );
}

export async function upsertStudents(students: Array<Record<string, string | null>>) {
  if (isWeb) {
    students.forEach((student) => {
      const key = student.studentId ?? student.id;
      if (key) webStudents.set(key, { ...student });
    });
    return;
  }
  await initDb();
  await Promise.all(
    students.map((student) =>
      db.runAsync(
        `INSERT OR REPLACE INTO students (id, studentId, firstName, lastName, program, yearLevel, semester, academicYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          student.id,
          student.studentId,
          student.firstName,
          student.lastName,
          student.program,
          student.yearLevel,
          student.semester,
          student.academicYear,
        ],
      ),
    ),
  );
}

export async function upsertOfferingStudents(offeringId: string, studentIds: string[]) {
  if (isWeb) {
    webOfferingStudents.set(offeringId, new Set(studentIds));
    return;
  }
  await initDb();
  await db.runAsync(`DELETE FROM offering_students WHERE offeringId = ?`, [offeringId]);
  await Promise.all(
    studentIds.map((studentId) =>
      db.runAsync(
        `INSERT OR IGNORE INTO offering_students (offeringId, studentId) VALUES (?, ?)`,
        [offeringId, studentId],
      ),
    ),
  );
}

export async function getOfferingById(offeringId: string): Promise<any | null> {
  if (isWeb) return webOfferings.get(offeringId) ?? null;
  await initDb();
  return (await db.getFirstAsync(`SELECT * FROM offerings WHERE id = ?`, [offeringId])) ?? null;
}

export async function getAttendanceRecord(
  studentId: string,
  offeringId: string,
  date: string,
): Promise<any | null> {
  if (isWeb) {
    return [...webAttendance.values()].find(
      (record) => record.studentId === studentId && record.offeringId === offeringId && record.date === date,
    ) ?? null;
  }
  await initDb();
  return (
    (await db.getFirstAsync(
      `SELECT * FROM attendance WHERE studentId = ? AND offeringId = ? AND date = ?`,
      [studentId, offeringId, date],
    )) ?? null
  );
}

export async function saveAttendanceRecord(
  record: AttendanceRecord,
): Promise<AttendanceSaveResult> {
  const parsedDate = new Date(`${record.date}T00:00:00Z`);
  if (!record.id || !record.studentId || !record.offeringId || !record.facultyId) {
    throw new Error("Attendance requires a local ID, student, offering, and faculty owner.");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== record.date
  ) {
    throw new Error("Attendance date must be a valid YYYY-MM-DD date.");
  }
  if (!validAttendanceStatuses.has(record.status)) {
    throw new Error("Attendance status must be present, late, absent, or excused.");
  }
  if (!Number.isFinite(record.updatedAt)) {
    throw new Error("Attendance requires a valid creation timestamp.");
  }
  if (isWeb) {
    const existing = await getAttendanceRecord(record.studentId, record.offeringId, record.date);
    const id = existing?.id ?? record.id;
    const syncStatus =
      existing && existing.status === record.status && existing.syncStatus === "synced"
        ? "synced"
        : "pending";
    const saved: AttendanceRecord = {
      ...record,
      id,
      serverId: existing?.serverId ?? record.serverId ?? null,
      lastSyncAt: existing?.lastSyncAt ?? record.lastSyncAt ?? null,
      retryCount: syncStatus === "synced" ? existing?.retryCount ?? 0 : 0,
      syncStatus,
    };
    webAttendance.set(`${record.studentId}:${record.offeringId}:${record.date}`, saved);
    return {
      ...saved,
      isUpdated: !!existing,
      previousStatus: existing?.status ?? null,
    };
  }
  await initDb();
  const existing = await getAttendanceRecord(record.studentId, record.offeringId, record.date);
  const id = existing ? existing.id : record.id;
  const previousStatus = existing?.status ?? null;
  const syncStatus =
    existing && existing.status === record.status && existing.syncStatus === "synced"
      ? "synced"
      : "pending";

  await db.runAsync(
    `INSERT OR REPLACE INTO attendance (id, studentId, studentName, offeringId, subjectCode, subjectName, facultyId, date, time, academicYear, semester, status, syncStatus, serverId, retryCount, nextRetryAt, lastAttemptAt, lastSyncAt, lastError, retryable, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      record.studentId,
      record.studentName,
      record.offeringId,
      record.subjectCode,
      record.subjectName,
      record.facultyId,
      record.date,
      record.time,
      record.academicYear,
      record.semester,
      record.status,
      syncStatus,
      existing?.serverId ?? record.serverId ?? null,
      syncStatus === "synced" ? existing?.retryCount ?? 0 : 0,
      null,
      null,
      syncStatus === "synced" ? existing?.lastSyncAt ?? null : null,
      null,
      1,
      record.updatedAt,
    ],
  );

  return {
    ...record,
    id,
    serverId: existing?.serverId ?? record.serverId ?? null,
    syncStatus,
    isUpdated: !!existing,
    previousStatus,
  };
}

export async function getOfferingRoster(offeringId: string, date: string): Promise<any[]> {
  if (isWeb) {
    return [...(webOfferingStudents.get(offeringId) ?? [])]
      .map((studentId) => webStudents.get(studentId))
      .filter(Boolean)
      .map((student: any) => {
        const attendance = [...webAttendance.values()].find(
          (record) => record.studentId === student!.studentId && record.offeringId === offeringId && record.date === date,
        );
        return {
          ...student,
          attendanceStatus: attendance?.status,
          attendanceSyncStatus: attendance?.syncStatus,
          attendanceId: attendance?.id,
        };
      })
      .sort((left, right) => `${left!.lastName} ${left!.firstName}`.localeCompare(`${right!.lastName} ${right!.firstName}`));
  }
  await initDb();
  return await db.getAllAsync(
    `SELECT st.*, a.status AS attendanceStatus, a.syncStatus AS attendanceSyncStatus, a.id AS attendanceId
     FROM offering_students os
     JOIN students st ON st.studentId = os.studentId
     LEFT JOIN attendance a ON a.studentId = st.studentId AND a.offeringId = os.offeringId AND a.date = ?
     WHERE os.offeringId = ?
     ORDER BY st.lastName, st.firstName`,
    [date, offeringId],
  );
}

export async function getTodayOfferings(facultyId: string): Promise<any[]> {
  if (isWeb) return [...webOfferings.values()].filter((offering) => offering.facultyId === facultyId);
  await initDb();
  return await db.getAllAsync(`SELECT * FROM offerings WHERE facultyId = ? ORDER BY subjectCode`, [
    facultyId,
  ]);
}

export async function getFacultyOfferings(facultyId: string): Promise<any[]> {
  if (isWeb) return [...webOfferings.values()].filter((offering) => offering.facultyId === facultyId);
  await initDb();
  return await db.getAllAsync(`SELECT * FROM offerings WHERE facultyId = ? ORDER BY subjectCode`, [
    facultyId,
  ]);
}

export async function getAttendanceHistory(facultyId: string): Promise<any[]> {
  if (isWeb) {
    return [...webAttendance.values()]
      .filter((record) => record.facultyId === facultyId)
      .sort((left, right) => right.date.localeCompare(left.date));
  }
  await initDb();
  return await db.getAllAsync(
    `SELECT * FROM attendance WHERE facultyId = ? ORDER BY date DESC, updatedAt DESC`,
    [facultyId],
  );
}

export async function getTotalStudentsForFaculty(facultyId: string): Promise<number> {
  if (isWeb) {
    const studentIds = new Set<string>();
    for (const [offeringId, students] of webOfferingStudents) {
      if (webOfferings.get(offeringId)?.facultyId === facultyId) students.forEach((studentId) => studentIds.add(studentId));
    }
    return studentIds.size;
  }
  await initDb();
  const row = (await db.getFirstAsync(
    `SELECT COUNT(DISTINCT os.studentId) AS count
     FROM offering_students os
     JOIN offerings o ON o.id = os.offeringId
     WHERE o.facultyId = ?`,
    [facultyId],
  )) as { count: number } | null;
  return row?.count ?? 0;
}

export async function getPendingAttendance(): Promise<any[]> {
  if (isWeb) {
    const now = Date.now();
    return [...webAttendance.values()].filter(
      (record) =>
        record.syncStatus === "pending" ||
        (record.syncStatus === "failed" &&
          record.retryable !== false &&
          record.retryable !== 0 &&
          (record.nextRetryAt == null || record.nextRetryAt <= now)),
    );
  }
  await initDb();
  return await db.getAllAsync(
    `SELECT * FROM attendance
     WHERE syncStatus = 'pending'
        OR (syncStatus = 'failed' AND retryable = 1 AND (nextRetryAt IS NULL OR nextRetryAt <= ?))
     ORDER BY updatedAt ASC`,
    [Date.now()],
  );
}

export async function getNextAttendanceRetryAt(): Promise<number | null> {
  if (isWeb) {
    const retryTimes = [...webAttendance.values()]
      .filter(
        (record) =>
          record.syncStatus === "failed" &&
          record.retryable !== false &&
          record.retryable !== 0 &&
          record.nextRetryAt != null,
      )
      .map((record) => Number(record.nextRetryAt));
    return retryTimes.length ? Math.min(...retryTimes) : null;
  }
  await initDb();
  const row = (await db.getFirstAsync(
    `SELECT MIN(nextRetryAt) AS nextRetryAt FROM attendance
     WHERE syncStatus = 'failed' AND retryable = 1 AND nextRetryAt IS NOT NULL`,
  )) as { nextRetryAt: number | null } | null;
  return row?.nextRetryAt ?? null;
}

export async function getAttendanceSyncSummary(): Promise<AttendanceSyncSummary> {
  if (isWeb) {
    const records = [...webAttendance.values()];
    return {
      pendingCount: records.filter((record) => record.syncStatus === "pending").length,
      syncingCount: records.filter((record) => record.syncStatus === "syncing").length,
      syncedCount: records.filter((record) => record.syncStatus === "synced").length,
      failedCount: records.filter((record) => record.syncStatus === "failed").length,
      retryableFailedCount: records.filter(
        (record) =>
          record.syncStatus === "failed" &&
          record.retryable !== false &&
          record.retryable !== 0,
      ).length,
      lastSyncAt: records.reduce<number | null>((latest, record) => {
        if (record.lastSyncAt == null) return latest;
        return latest == null ? record.lastSyncAt : Math.max(latest, record.lastSyncAt);
      }, null),
    };
  }
  await initDb();
  const row = (await db.getFirstAsync(
    `SELECT
       SUM(CASE WHEN syncStatus = 'pending' THEN 1 ELSE 0 END) AS pendingCount,
       SUM(CASE WHEN syncStatus = 'syncing' THEN 1 ELSE 0 END) AS syncingCount,
       SUM(CASE WHEN syncStatus = 'synced' THEN 1 ELSE 0 END) AS syncedCount,
       SUM(CASE WHEN syncStatus = 'failed' THEN 1 ELSE 0 END) AS failedCount,
       SUM(CASE WHEN syncStatus = 'failed' AND retryable = 1 THEN 1 ELSE 0 END) AS retryableFailedCount,
       MAX(lastSyncAt) AS lastSyncAt
     FROM attendance`,
  )) as Omit<AttendanceSyncSummary, "lastSyncAt"> & { lastSyncAt: number | null };
  return {
    pendingCount: row.pendingCount ?? 0,
    syncingCount: row.syncingCount ?? 0,
    syncedCount: row.syncedCount ?? 0,
    failedCount: row.failedCount ?? 0,
    retryableFailedCount: row.retryableFailedCount ?? 0,
    lastSyncAt: row.lastSyncAt ?? null,
  };
}

export async function markAttendanceSyncing(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const now = Date.now();
  if (isWeb) {
    for (const [key, record] of webAttendance) {
      if (ids.includes(record.id)) {
        webAttendance.set(key, { ...record, syncStatus: "syncing", lastAttemptAt: now });
      }
    }
    return;
  }
  await initDb();
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(
        `UPDATE attendance SET syncStatus = 'syncing', lastAttemptAt = ? WHERE id = ?`,
        [now, id],
      );
    }
  });
}

export async function markAttendanceSynced(id: string, serverId: string): Promise<void> {
  const now = Date.now();
  if (isWeb) {
    for (const [key, record] of webAttendance) {
      if (record.id === id) {
        webAttendance.set(key, {
          ...record,
          serverId,
          syncStatus: "synced",
          lastSyncAt: now,
          lastError: null,
          retryCount: 0,
          nextRetryAt: null,
          retryable: true,
        });
      }
    }
    return;
  }
  await initDb();
  await db.runAsync(
    `UPDATE attendance
     SET serverId = ?, syncStatus = 'synced', lastSyncAt = ?, lastError = NULL,
         retryCount = 0, nextRetryAt = NULL, retryable = 1
     WHERE id = ?`,
    [serverId, now, id],
  );
}

const MAX_SYNC_ATTEMPTS = 8;
const INITIAL_RETRY_DELAY = 30_000;
const MAX_RETRY_DELAY = 60 * 60 * 1000;

export async function markAttendanceFailed(
  id: string,
  error: string,
  retryable: boolean,
): Promise<void> {
  if (isWeb) {
    for (const [key, record] of webAttendance) {
      if (record.id !== id || record.syncStatus === "synced") continue;
      const retryCount = (record.retryCount ?? 0) + 1;
      const canRetry = retryable && retryCount < MAX_SYNC_ATTEMPTS;
      const delay = Math.min(MAX_RETRY_DELAY, INITIAL_RETRY_DELAY * 2 ** (retryCount - 1));
      webAttendance.set(key, {
        ...record,
        syncStatus: "failed",
        retryCount,
        nextRetryAt: canRetry ? Date.now() + delay : null,
        lastError: error,
        retryable: canRetry,
      });
    }
    return;
  }
  await initDb();
  const row = (await db.getFirstAsync(
    `SELECT retryCount FROM attendance WHERE id = ?`,
    [id],
  )) as { retryCount: number } | null;
  if (!row) return;
  const retryCount = row.retryCount + 1;
  const canRetry = retryable && retryCount < MAX_SYNC_ATTEMPTS;
  const delay = Math.min(MAX_RETRY_DELAY, INITIAL_RETRY_DELAY * 2 ** (retryCount - 1));
  await db.runAsync(
    `UPDATE attendance
     SET syncStatus = 'failed', retryCount = ?, nextRetryAt = ?, lastError = ?, retryable = ?
     WHERE id = ? AND syncStatus != 'synced'`,
    [retryCount, canRetry ? Date.now() + delay : null, error, canRetry ? 1 : 0, id],
  );
}

export async function retryFailedAttendance(): Promise<void> {
  if (isWeb) {
    for (const [key, record] of webAttendance) {
      if (
        record.syncStatus === "failed" &&
        record.retryable !== false &&
        record.retryable !== 0
      ) {
        webAttendance.set(key, { ...record, syncStatus: "pending", nextRetryAt: null });
      }
    }
    return;
  }
  await initDb();
  await db.runAsync(
    `UPDATE attendance SET syncStatus = 'pending', nextRetryAt = NULL
     WHERE syncStatus = 'failed' AND retryable = 1`,
  );
}