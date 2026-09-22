import * as SQLite from "expo-sqlite";

const DB_NAME = "piat_mobile.db";
const db = SQLite.openDatabaseSync(DB_NAME);

// ---------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------
export async function initDb() {
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
      updatedAt INTEGER NOT NULL,
      UNIQUE(studentId, offeringId, date)
    );
  `);

  const offeringColumns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(offerings)`);
  if (!offeringColumns.some((column) => column.name === "enrolledStudentCount")) {
    await db.execAsync(`ALTER TABLE offerings ADD COLUMN enrolledStudentCount INTEGER NOT NULL DEFAULT 0`);
  }
}

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
export type AttendanceSyncStatus = "pending" | "synced" | "failed";

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
  updatedAt: number;
}

export interface AttendanceSaveResult extends AttendanceRecord {
  isUpdated: boolean;
  previousStatus: string | null;
}

// ---------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------
export async function upsertFaculty(faculty: Record<string, string | null>) {
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
  return (await db.getFirstAsync(`SELECT * FROM offerings WHERE id = ?`, [offeringId])) ?? null;
}

export async function getAttendanceRecord(
  studentId: string,
  offeringId: string,
  date: string,
): Promise<any | null> {
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
  const existing = await getAttendanceRecord(record.studentId, record.offeringId, record.date);
  const id = existing ? existing.id : record.id;
  const previousStatus = existing?.status ?? null;
  const syncStatus =
    existing && existing.status === record.status && existing.syncStatus === "synced"
      ? "synced"
      : "pending";

  await db.runAsync(
    `INSERT OR REPLACE INTO attendance (id, studentId, studentName, offeringId, subjectCode, subjectName, facultyId, date, time, academicYear, semester, status, syncStatus, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      record.updatedAt,
    ],
  );

  return { ...record, id, syncStatus, isUpdated: !!existing, previousStatus };
}

export async function getOfferingRoster(offeringId: string, date: string): Promise<any[]> {
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
  return await db.getAllAsync(`SELECT * FROM offerings WHERE facultyId = ? ORDER BY subjectCode`, [
    facultyId,
  ]);
}

export async function getTotalStudentsForFaculty(facultyId: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT os.studentId) AS count
     FROM offering_students os
     JOIN offerings o ON o.id = os.offeringId
     WHERE o.facultyId = ?`,
    [facultyId],
  );
  return row?.count ?? 0;
}

export async function getPendingAttendance(): Promise<any[]> {
  return await db.getAllAsync(
    `SELECT * FROM attendance WHERE syncStatus = 'pending' OR syncStatus = 'failed' ORDER BY updatedAt ASC`,
  );
}

export async function updateAttendanceSyncStatus(id: string, syncStatus: AttendanceSyncStatus) {
  await db.runAsync(`UPDATE attendance SET syncStatus = ? WHERE id = ?`, [syncStatus, id]);
}