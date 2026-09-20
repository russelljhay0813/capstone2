import sqlite3 from "sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.PIAT_DB_PATH || path.join(__dirname, "bwest.db");

function hashSeedPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

// ---------------------------------------------------------------------
// Database helper functions
// ---------------------------------------------------------------------
export function openDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

export function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function withTransaction(db, callback) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await run(db, "BEGIN");
        const result = await callback();
        await run(db, "COMMIT");
        resolve(result);
      } catch (error) {
        await run(db, "ROLLBACK").catch(() => {});
        reject(error);
      }
    });
  });
}

// ---------------------------------------------------------------------
// Helper to check if a column exists (for future migrations)
// ---------------------------------------------------------------------
async function columnExists(db, table, column) {
  const rows = await all(db, `PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function addColumnIfMissing(db, table, column, type) {
  if (!(await columnExists(db, table, column))) {
    await run(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

// ---------------------------------------------------------------------
// Create indexes for foreign keys
// ---------------------------------------------------------------------
async function createFkIndexes(db) {
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_semesters_academicYearId ON semesters(academicYearId)",
    "CREATE INDEX IF NOT EXISTS idx_sections_programId ON sections(programId)",
    "CREATE INDEX IF NOT EXISTS idx_sections_semesterId ON sections(semesterId)",
    "CREATE INDEX IF NOT EXISTS idx_sections_academicYearId ON sections(academicYearId)",
    "CREATE INDEX IF NOT EXISTS idx_curriculum_programId ON curriculum(programId)",
    "CREATE INDEX IF NOT EXISTS idx_curriculum_subjectId ON curriculum(subjectId)",
    "CREATE INDEX IF NOT EXISTS idx_subjectOfferings_subjectId ON subjectOfferings(subjectId)",
    "CREATE INDEX IF NOT EXISTS idx_subjectOfferings_academicYearId ON subjectOfferings(academicYearId)",
    "CREATE INDEX IF NOT EXISTS idx_subjectOfferings_semesterId ON subjectOfferings(semesterId)",
    "CREATE INDEX IF NOT EXISTS idx_subjectOfferings_sectionId ON subjectOfferings(sectionId)",
    "CREATE INDEX IF NOT EXISTS idx_subjectOfferings_facultyId ON subjectOfferings(facultyId)",
    "CREATE INDEX IF NOT EXISTS idx_enrollments_studentId ON enrollments(studentId)",
    "CREATE INDEX IF NOT EXISTS idx_enrollments_offeringId ON enrollments(subjectOfferingId)",
    "CREATE INDEX IF NOT EXISTS idx_grades_studentId ON grades(studentId)",
    "CREATE INDEX IF NOT EXISTS idx_grades_offeringId ON grades(subjectOfferingId)",
    "CREATE INDEX IF NOT EXISTS idx_attendance_studentId ON attendance(studentId)",
    "CREATE INDEX IF NOT EXISTS idx_attendance_offeringId ON attendance(subjectOfferingId)",
    "CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)",
    "CREATE INDEX IF NOT EXISTS idx_faculty_userId ON faculty(userId)",
    "CREATE INDEX IF NOT EXISTS idx_students_userId ON students(userId)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId)",
    "CREATE INDEX IF NOT EXISTS idx_activityLogs_actorId ON activityLogs(actorId)",
    "CREATE INDEX IF NOT EXISTS idx_academicRecords_studentId ON academicRecords(studentId)",
    "CREATE INDEX IF NOT EXISTS idx_academicRecords_offeringId ON academicRecords(subjectOfferingId)",
  ];
  for (const sql of indexes) {
    await run(db, sql);
  }
}

// ---------------------------------------------------------------------
// MAIN INITIALIZATION
// ---------------------------------------------------------------------
export async function initDb(db) {
  await run(db, "PRAGMA foreign_keys = ON");

  // ------------------------------------------------------------------
  // 1. CREATE TABLES (normalized schema)
  // ------------------------------------------------------------------

  // Programs
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      createdAt INTEGER NOT NULL
    )`,
  );

  // Academic years
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS academicYears (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      startDate TEXT,
      endDate TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      createdAt INTEGER NOT NULL
    )`,
  );

  // Semesters
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS semesters (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      academicYearId TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (academicYearId) REFERENCES academicYears(id) ON DELETE SET NULL
    )`,
  );

  // Sections (class groups)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      programId TEXT,
      yearLevel TEXT,
      semesterId TEXT,
      academicYearId TEXT,
      capacity INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (programId) REFERENCES programs(id) ON DELETE SET NULL,
      FOREIGN KEY (semesterId) REFERENCES semesters(id) ON DELETE SET NULL,
      FOREIGN KEY (academicYearId) REFERENCES academicYears(id) ON DELETE SET NULL
    )`,
  );

  // Users (system login)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      middleName TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'faculty', 'registrar', 'student')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      createdAt INTEGER NOT NULL,
      temporaryPassword TEXT,
      firstLoginAt INTEGER,
      lastLoginAt INTEGER
    )`,
  );

  // Students (personal info – no academic fields)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      studentId TEXT UNIQUE NOT NULL,
      userId TEXT UNIQUE,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      middleName TEXT,
      suffix TEXT,
      email TEXT UNIQUE,
      password TEXT NOT NULL,
      gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')),
      dob TEXT,
      civilStatus TEXT,
      nationality TEXT,
      religion TEXT,
      educationLevel TEXT NOT NULL,
      previousSchool TEXT,
      lastGrade TEXT,
      contactNumber TEXT,
      address TEXT,
      city TEXT,
      province TEXT,
      zip TEXT,
      fatherName TEXT,
      fatherOccupation TEXT,
      fatherContact TEXT,
      motherName TEXT,
      motherOccupation TEXT,
      motherContact TEXT,
      guardianName TEXT,
      guardianOccupation TEXT,
      guardianContact TEXT,
      guardianRelation TEXT,
      parentName TEXT,
      parentContact TEXT,
      parentAddress TEXT,
      emergencyName TEXT,
      emergencyContact TEXT,
      emergencyAddress TEXT,
      emergencyRelation TEXT,
      placeOfBirth TEXT,
      barangay TEXT,
      parentRelationship TEXT,
      status TEXT CHECK(status IN ('active', 'inactive', 'graduated', 'transferred', 'pending', 'approved', 'rejected')),
      submittedAt INTEGER,
      reviewedAt INTEGER,
      reviewNote TEXT,
      firstLoginAt INTEGER,
      lastLoginAt INTEGER,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    )`,
  );
  const studentColumns = await all(db, "PRAGMA table_info(students)");
  if (!studentColumns.some((column) => column.name === "region")) {
    await run(db, "ALTER TABLE students ADD COLUMN region TEXT");
  }

  // Faculty (teaching staff)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS faculty (
      id TEXT PRIMARY KEY,
      userId TEXT UNIQUE NOT NULL,
      employeeId TEXT UNIQUE,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      middleName TEXT,
      email TEXT UNIQUE NOT NULL,
      department TEXT,
      designation TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`,
  );

  // Subjects (global list)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      units INTEGER NOT NULL,
      description TEXT
    )`,
  );

  // Curriculum (maps subjects to programs, year, semester)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS curriculum (
      id TEXT PRIMARY KEY,
      programId TEXT NOT NULL,
      yearLevel TEXT NOT NULL,
      semester TEXT NOT NULL,  -- e.g., '1st Semester', '2nd Semester', 'Summer'
      subjectId TEXT NOT NULL,
      FOREIGN KEY (programId) REFERENCES programs(id) ON DELETE CASCADE,
      FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE,
      UNIQUE(programId, yearLevel, semester, subjectId)
    )`,
  );

  // Subject Offerings (specific instance per academic year, semester, section)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS subjectOfferings (
      id TEXT PRIMARY KEY,
      subjectId TEXT NOT NULL,
      academicYearId TEXT NOT NULL,
      semesterId TEXT NOT NULL,
      sectionId TEXT NOT NULL,
      facultyId TEXT,
      schedule TEXT,
      room TEXT,
      capacity INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'closed')),
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (academicYearId) REFERENCES academicYears(id) ON DELETE CASCADE,
      FOREIGN KEY (semesterId) REFERENCES semesters(id) ON DELETE CASCADE,
      FOREIGN KEY (sectionId) REFERENCES sections(id) ON DELETE CASCADE,
      FOREIGN KEY (facultyId) REFERENCES faculty(id) ON DELETE SET NULL,
      UNIQUE(subjectId, academicYearId, semesterId, sectionId)
    )`,
  );

  // Enrollments (student enrollment in a specific offering)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      subjectOfferingId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'enrolled' CHECK(status IN ('enrolled', 'dropped', 'completed')),
      enrolledAt INTEGER NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (subjectOfferingId) REFERENCES subjectOfferings(id) ON DELETE CASCADE,
      UNIQUE(studentId, subjectOfferingId)
    )`,
  );

  // Grades
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      subjectOfferingId TEXT NOT NULL,
      grade REAL,
      remarks TEXT,
      period TEXT CHECK(period IN ('prelim', 'midterm', 'final', 'overall')),
      type TEXT CHECK(type IN ('activity', 'quiz', 'exam', 'overall')),
      component TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'finalized')),
      submittedAt INTEGER NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (subjectOfferingId) REFERENCES subjectOfferings(id) ON DELETE CASCADE,
      UNIQUE(studentId, subjectOfferingId, period, type)
    )`,
  );

  // Attendance
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      subjectOfferingId TEXT NOT NULL,
      date TEXT NOT NULL,          -- ISO date string
      time TEXT,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late', 'excused')),
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (subjectOfferingId) REFERENCES subjectOfferings(id) ON DELETE CASCADE,
      UNIQUE(studentId, subjectOfferingId, date)
    )`,
  );

  // Academic Records (summary/transcript)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS academicRecords (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      subjectOfferingId TEXT,
      academicYearId TEXT,
      semesterId TEXT,
      recordType TEXT NOT NULL DEFAULT 'summary' CHECK(recordType IN ('summary', 'transcript', 'certificate')),
      summary TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (subjectOfferingId) REFERENCES subjectOfferings(id) ON DELETE SET NULL,
      FOREIGN KEY (academicYearId) REFERENCES academicYears(id) ON DELETE SET NULL,
      FOREIGN KEY (semesterId) REFERENCES semesters(id) ON DELETE SET NULL
    )`,
  );

  // Notifications
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0 CHECK(read IN (0,1)),
      createdAt INTEGER NOT NULL,
      relatedId TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`,
  );

  // Announcements
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT CHECK(category IN ('general', 'academic', 'event', 'urgent')),
      audience TEXT CHECK(audience IN ('all', 'student', 'faculty')),
      subjectId TEXT,
      pinned INTEGER DEFAULT 0 CHECK(pinned IN (0,1)),
      authorName TEXT,
      authorRole TEXT,
      createdAt INTEGER NOT NULL,
      datePosted TEXT
    )`,
  );

  // Activity Logs
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS activityLogs (
      id TEXT PRIMARY KEY,
      actorId TEXT NOT NULL,
      actorName TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      role TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (actorId) REFERENCES users(id) ON DELETE CASCADE
    )`,
  );

  // Settings
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'string',
      updatedAt INTEGER NOT NULL
    )`,
  );

  // ------------------------------------------------------------------
  // 2. CREATE INDEXES
  // ------------------------------------------------------------------
  await createFkIndexes(db);

  // ------------------------------------------------------------------
  // 3. RECONCILE INVALID APPROVED-EMPTY STUDENT RECORDS
  // ------------------------------------------------------------------
  const invalidApprovedStudents = await all(
    db,
    `SELECT s.id, s.studentId, s.status
     FROM students s
     LEFT JOIN enrollments e ON e.studentId = s.id
     WHERE s.status = 'approved'
     GROUP BY s.id, s.studentId, s.status
     HAVING COUNT(e.id) = 0`,
  );
  for (const student of invalidApprovedStudents) {
    await run(
      db,
      "UPDATE students SET status = 'pending', reviewedAt = NULL, reviewNote = ? WHERE id = ?",
      ["Created by admin; registration requires completion before approval.", student.id],
    );
  }

  // ------------------------------------------------------------------
  // 4. GENERATE MISSING SUBJECT OFFERINGS FROM CURRICULUM
  // ------------------------------------------------------------------
  const activePrograms = await all(db, "SELECT * FROM programs WHERE status = 'active'");
  const activeAcademicYears = await all(db, "SELECT * FROM academicYears WHERE status = 'active' ORDER BY code DESC");
  for (const program of activePrograms) {
    for (const academicYear of activeAcademicYears) {
      const semesters = await all(db, "SELECT * FROM semesters WHERE academicYearId = ? AND status = 'active' ORDER BY sequence", [academicYear.id]);
      for (const semester of semesters) {
        const yearLevels = await all(
          db,
          "SELECT DISTINCT yearLevel FROM curriculum WHERE programId = ? AND semester = ? ORDER BY yearLevel",
          [program.id, semester.code],
        );
        for (const yearLevelRow of yearLevels) {
          let section = await get(
            db,
            "SELECT id FROM sections WHERE programId = ? AND yearLevel = ? AND semesterId = ? AND academicYearId = ?",
            [program.id, yearLevelRow.yearLevel, semester.id, academicYear.id],
          );
          if (!section) {
            const programHash = crypto.createHash("md5").update(String(program.id || program.name || "program")).digest("hex").slice(0, 6).toUpperCase();
            const yearToken = String(yearLevelRow.yearLevel || "1st Year").replace(/\D/g, "").slice(0, 2) || "1";
            const semesterToken = String(semester.sequence || "1").padStart(2, "0");
            const academicToken = String(academicYear.code || "2026-2027").replace(/[^0-9]/g, "").slice(-2) || "26";
            const sectionCode = `SEC-${programHash}-${yearToken}-${semesterToken}-${academicToken}`;
            const sectionId = crypto.randomUUID();
            await run(
              db,
              `INSERT INTO sections (id, code, name, programId, yearLevel, semesterId, academicYearId, status, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [sectionId, sectionCode, `${yearLevelRow.yearLevel} ${semester.name}`, program.id, yearLevelRow.yearLevel, semester.id, academicYear.id, "active", Date.now()],
            );
            section = { id: sectionId };
          }

          const curriculumItems = await all(
            db,
            "SELECT subjectId FROM curriculum WHERE programId = ? AND yearLevel = ? AND semester = ?",
            [program.id, yearLevelRow.yearLevel, semester.code],
          );
          for (const item of curriculumItems) {
            const existingOffering = await get(
              db,
              "SELECT id FROM subjectOfferings WHERE subjectId = ? AND academicYearId = ? AND semesterId = ? AND sectionId = ?",
              [item.subjectId, academicYear.id, semester.id, section.id],
            );
            if (!existingOffering) {
              await run(
                db,
                `INSERT INTO subjectOfferings (id, subjectId, academicYearId, semesterId, sectionId, schedule, room, status, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [crypto.randomUUID(), item.subjectId, academicYear.id, semester.id, section.id, "TBA", "TBA", "active", Date.now()],
              );
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 5. SEED INITIAL DATA (if empty)
  // ------------------------------------------------------------------

  // ---- Academic Years ----
  const existingAY = await get(db, "SELECT id FROM academicYears LIMIT 1");
  if (!existingAY) {
    const years = [
      { code: "2025-2026", name: "Academic Year 2025-2026", start: "2025-06-01", end: "2026-03-31" },
      { code: "2026-2027", name: "Academic Year 2026-2027", start: "2026-06-01", end: "2027-03-31" },
      { code: "2027-2028", name: "Academic Year 2027-2028", start: "2027-06-01", end: "2028-03-31" },
      { code: "2028-2029", name: "Academic Year 2028-2029", start: "2028-06-01", end: "2029-03-31" },
    ];
    const now = Date.now();
    for (const y of years) {
      await run(
        db,
        `INSERT INTO academicYears (id, code, name, startDate, endDate, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), y.code, y.name, y.start, y.end, "active", now]
      );
    }

    // ---- Semesters (linked to first academic year) ----
    const firstAY = await get(db, "SELECT id FROM academicYears ORDER BY code LIMIT 1");
    if (firstAY) {
      const semesters = [
        { code: "1st Semester", name: "First Semester", seq: 1 },
        { code: "2nd Semester", name: "Second Semester", seq: 2 },
        { code: "Summer", name: "Summer Term", seq: 3 },
      ];
      for (const s of semesters) {
        await run(
          db,
          `INSERT INTO semesters (id, code, name, sequence, academicYearId, status, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), s.code, s.name, s.seq, firstAY.id, "active", now]
        );
      }
    }
  }

  // Keep the semester catalog available for every academic year, including databases created before this schema was normalized.
  const academicYears = await all(db, "SELECT id, code FROM academicYears");
  const semesterTemplates = [
    { code: "1st Semester", name: "First Semester", sequence: 1 },
    { code: "2nd Semester", name: "Second Semester", sequence: 2 },
    { code: "Summer", name: "Summer Term", sequence: 3 },
  ];
  for (const academicYear of academicYears) {
    for (const semester of semesterTemplates) {
      const existingSemester = await get(
        db,
        "SELECT id FROM semesters WHERE academicYearId = ? AND name = ? AND sequence = ?",
        [academicYear.id, semester.name, semester.sequence],
      );
      if (!existingSemester) {
        await run(
          db,
          `INSERT INTO semesters (id, code, name, sequence, academicYearId, status, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            `${semester.code} (${academicYear.code})`,
            semester.name,
            semester.sequence,
            academicYear.id,
            "active",
            Date.now(),
          ],
        );
      }
    }
  }

  // ---- Programs and Curriculum ----
  const existingProg = await get(db, "SELECT id FROM programs LIMIT 1");
  if (!existingProg) {
    const programNames = [
      "Diploma in Hospitality Services and Technology",
      "Diploma in Tourism and Travel Services",
      "Diploma in Multimedia Arts and Design",
      "Diploma in Industrial Education (Major in Hotel and Restaurant Services)",
      "Diploma in Industrial Education (Major in Multimedia Arts and Design)",
    ];
    const now = Date.now();
    const progIds = {};
    for (const name of programNames) {
      const id = crypto.randomUUID();
      progIds[name] = id;
      await run(
        db,
        `INSERT INTO programs (id, name, description, status, createdAt) VALUES (?, ?, ?, ?, ?)`,
        [id, name, "", "active", now]
      );
    }

    // ---- Full Curriculum Data (copied verbatim from your original file) ----
    const curriculumItems = [
      ["Diploma in Hospitality Services and Technology", "1st Year", "1st Semester", "COM 101", "Purposive Communication", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "1st Semester", "MATH 101", "Mathematics in the Modern World", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "1st Semester", "HOS 101", "Introduction to Hospitality Industry", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "1st Semester", "HOS 102", "Fundamentals of Food Service Operations", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "1st Semester", "HOS 103", "Basic Housekeeping Procedures", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "1st Semester", "CS 101", "Computer Fundamentals", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "1st Semester", "PE 101", "Physical Fitness 1", 2],
      ["Diploma in Hospitality Services and Technology", "1st Year", "1st Semester", "NSTP 101", "National Service Training Program 1", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "2nd Semester", "PSY 101", "Understanding the Self", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "2nd Semester", "HIST 101", "Readings in Philippine History", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "2nd Semester", "HOS 104", "Front Office Operations", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "2nd Semester", "HOS 105", "Food and Beverage Service", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "2nd Semester", "HOS 106", "Basic Culinary Arts", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "2nd Semester", "HOS 107", "Hospitality Computer Applications", 3],
      ["Diploma in Hospitality Services and Technology", "1st Year", "2nd Semester", "PE 102", "Physical Fitness 2", 2],
      ["Diploma in Hospitality Services and Technology", "1st Year", "2nd Semester", "NSTP 102", "National Service Training Program 2", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "1st Semester", "HOS 201", "Kitchen Operations", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "1st Semester", "HOS 202", "Housekeeping Management", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "1st Semester", "HOS 203", "Food Safety and Sanitation", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "1st Semester", "HOS 204", "Event Planning Fundamentals", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "1st Semester", "HOS 205", "Customer Service Excellence", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "1st Semester", "ACC 101", "Hospitality Accounting", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "1st Semester", "LANG 101", "Foreign Language for Hospitality I", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "2nd Semester", "HOS 206", "Restaurant Operations", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "2nd Semester", "HOS 207", "Hotel Operations Management", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "2nd Semester", "HOS 208", "Bartending and Beverage Management", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "2nd Semester", "HOS 209", "Tourism Geography", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "2nd Semester", "MKT 101", "Hospitality Marketing", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "2nd Semester", "LANG 102", "Foreign Language for Hospitality II", 3],
      ["Diploma in Hospitality Services and Technology", "2nd Year", "2nd Semester", "ENT 101", "Entrepreneurship", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "1st Semester", "HOS 301", "Hospitality Human Resource Management", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "1st Semester", "HOS 302", "Banquet and Catering Management", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "1st Semester", "MKT 301", "Hospitality Sales and Marketing", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "1st Semester", "HOS 303", "Property Management Systems", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "1st Semester", "HOS 304", "Sustainable Hospitality", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "1st Semester", "RES 101", "Research Methods", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "2nd Semester", "FIN 101", "Hospitality Financial Management", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "2nd Semester", "HOS 305", "Resort Operations", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "2nd Semester", "HOS 306", "Hospitality Laws and Ethics", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "2nd Semester", "HOS 307", "Leadership and Supervision", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "2nd Semester", "HOS 308", "Events Management", 3],
      ["Diploma in Hospitality Services and Technology", "3rd Year", "2nd Semester", "FEAS 101", "Feasibility Study", 3],
      ["Diploma in Hospitality Services and Technology", "4th Year", "1st Semester", "HOS 401", "Strategic Hospitality Management", 3],
      ["Diploma in Hospitality Services and Technology", "4th Year", "1st Semester", "HOS 402", "Hospitality Innovation and Technology", 3],
      ["Diploma in Hospitality Services and Technology", "4th Year", "1st Semester", "HOS 403", "Quality Assurance in Hospitality", 3],
      ["Diploma in Hospitality Services and Technology", "4th Year", "1st Semester", "OJT 401", "Internship/OJT (300-600 Hours)", 6],
      ["Diploma in Hospitality Services and Technology", "4th Year", "2nd Semester", "CAP 401", "Capstone Project", 3],
      ["Diploma in Hospitality Services and Technology", "4th Year", "2nd Semester", "OJT 402", "Internship II", 3],
      ["Diploma in Hospitality Services and Technology", "4th Year", "2nd Semester", "SEMINAR 401", "Seminar in Hospitality Trends", 2],
      ["Diploma in Hospitality Services and Technology", "4th Year", "2nd Semester", "CAREER 101", "Career Development", 2],
      ["Diploma in Tourism and Travel Services", "1st Year", "1st Semester", "COM 101", "Purposive Communication", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "1st Semester", "MATH 101", "Mathematics in the Modern World", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "1st Semester", "TOUR 101", "Introduction to Tourism", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "1st Semester", "TOUR 102", "Tourism Geography", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "1st Semester", "CS 101", "Computer Applications", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "1st Semester", "PE 101", "Physical Fitness 1", 2],
      ["Diploma in Tourism and Travel Services", "1st Year", "1st Semester", "NSTP 101", "National Service Training Program 1", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "2nd Semester", "PSY 101", "Understanding the Self", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "2nd Semester", "HIST 101", "Philippine History", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "2nd Semester", "TOUR 103", "Tourism Principles", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "2nd Semester", "TOUR 104", "Customer Relations", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "2nd Semester", "TOUR 105", "Tour Guiding Fundamentals", 3],
      ["Diploma in Tourism and Travel Services", "1st Year", "2nd Semester", "PE 102", "Physical Fitness 2", 2],
      ["Diploma in Tourism and Travel Services", "1st Year", "2nd Semester", "NSTP 102", "National Service Training Program 2", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "1st Semester", "TOUR 201", "Airline Ticketing and Reservation Systems", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "1st Semester", "TOUR 202", "Travel Agency Operations", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "1st Semester", "TOUR 203", "Tour Packaging", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "1st Semester", "TOUR 204", "Tourism Marketing", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "1st Semester", "ECON 101", "Tourism Economics", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "1st Semester", "LANG 101", "Foreign Language I", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "2nd Semester", "TOUR 205", "Airport and Airline Operations", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "2nd Semester", "TOUR 206", "Sustainable Tourism", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "2nd Semester", "TOUR 207", "Tour Guiding Techniques", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "2nd Semester", "TOUR 208", "Event Tourism", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "2nd Semester", "ENT 101", "Entrepreneurship", 3],
      ["Diploma in Tourism and Travel Services", "2nd Year", "2nd Semester", "LANG 102", "Foreign Language II", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "1st Semester", "TOUR 301", "International Tourism", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "1st Semester", "TOUR 302", "Ecotourism Management", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "1st Semester", "TOUR 303", "Cruise Operations", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "1st Semester", "TOUR 304", "Hospitality and Tourism Laws", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "1st Semester", "RES 101", "Tourism Research", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "2nd Semester", "TOUR 305", "Destination Management", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "2nd Semester", "TOUR 306", "MICE (Meetings, Incentives, Conferences and Exhibitions)", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "2nd Semester", "TOUR 307", "Tourism Planning", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "2nd Semester", "STAT 101", "Tourism Statistics", 3],
      ["Diploma in Tourism and Travel Services", "3rd Year", "2nd Semester", "FEAS 101", "Feasibility Study", 3],
      ["Diploma in Tourism and Travel Services", "4th Year", "1st Semester", "TOUR 401", "Tourism Management Strategies", 3],
      ["Diploma in Tourism and Travel Services", "4th Year", "1st Semester", "QM 101", "Quality Management", 3],
      ["Diploma in Tourism and Travel Services", "4th Year", "1st Semester", "OJT 401", "Internship/OJT", 6],
      ["Diploma in Tourism and Travel Services", "4th Year", "2nd Semester", "CAP 401", "Capstone Project", 3],
      ["Diploma in Tourism and Travel Services", "4th Year", "2nd Semester", "OJT 402", "Internship II", 3],
      ["Diploma in Tourism and Travel Services", "4th Year", "2nd Semester", "SEMINAR 401", "Tourism Seminar", 2],
      ["Diploma in Tourism and Travel Services", "4th Year", "2nd Semester", "CAREER 101", "Career Preparation", 2],
      ["Diploma in Multimedia Arts and Design", "1st Year", "1st Semester", "COM 101", "Purposive Communication", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "1st Semester", "MDA 101", "Introduction to Multimedia Arts", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "1st Semester", "DRAW 101", "Drawing Fundamentals", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "1st Semester", "DES 101", "Design Principles", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "1st Semester", "CS 101", "Computer Fundamentals", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "1st Semester", "MDA 102", "Digital Imaging", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "1st Semester", "PE 101", "Physical Fitness 1", 2],
      ["Diploma in Multimedia Arts and Design", "1st Year", "1st Semester", "NSTP 101", "National Service Training Program 1", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "2nd Semester", "PSY 101", "Understanding the Self", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "2nd Semester", "ART 101", "Art Appreciation", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "2nd Semester", "DES 102", "Typography", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "2nd Semester", "DES 103", "Graphic Design", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "2nd Semester", "DES 104", "Color Theory", 3],
      ["Diploma in Multimedia Arts and Design", "1st Year", "2nd Semester", "PE 102", "Physical Fitness 2", 2],
      ["Diploma in Multimedia Arts and Design", "1st Year", "2nd Semester", "NSTP 102", "National Service Training Program 2", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "1st Semester", "MDA 201", "Adobe Photoshop", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "1st Semester", "MDA 202", "Adobe Illustrator", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "1st Semester", "MDA 203", "Photography", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "1st Semester", "DES 201", "Branding and Identity Design", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "1st Semester", "MDA 204", "Digital Illustration", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "1st Semester", "WEB 101", "Web Design Fundamentals", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "2nd Semester", "MDA 205", "Adobe InDesign", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "2nd Semester", "MDA 206", "Motion Graphics", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "2nd Semester", "MDA 207", "Video Editing", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "2nd Semester", "DES 202", "UI/UX Design", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "2nd Semester", "MDA 208", "Audio Production", 3],
      ["Diploma in Multimedia Arts and Design", "2nd Year", "2nd Semester", "ENT 101", "Entrepreneurship", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "1st Semester", "MDA 301", "Animation Principles", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "1st Semester", "MDA 302", "2D Animation", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "1st Semester", "MDA 303", "3D Modeling", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "1st Semester", "MDA 304", "Visual Effects", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "1st Semester", "MDA 305", "Storyboarding", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "1st Semester", "RES 101", "Multimedia Research", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "2nd Semester", "MDA 306", "3D Animation", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "2nd Semester", "MDA 307", "Game Art Fundamentals", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "2nd Semester", "WEB 201", "Web Development", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "2nd Semester", "PORT 101", "Portfolio Development", 3],
      ["Diploma in Multimedia Arts and Design", "3rd Year", "2nd Semester", "CAP 301", "Capstone Proposal", 3],
      ["Diploma in Multimedia Arts and Design", "4th Year", "1st Semester", "MDA 401", "Advanced Multimedia Production", 3],
      ["Diploma in Multimedia Arts and Design", "4th Year", "1st Semester", "MDA 402", "Creative Project Management", 3],
      ["Diploma in Multimedia Arts and Design", "4th Year", "1st Semester", "OJT 401", "Internship/OJT", 6],
      ["Diploma in Multimedia Arts and Design", "4th Year", "2nd Semester", "CAP 401", "Capstone Project", 3],
      ["Diploma in Multimedia Arts and Design", "4th Year", "2nd Semester", "OJT 402", "Internship II", 3],
      ["Diploma in Multimedia Arts and Design", "4th Year", "2nd Semester", "MDA 403", "Portfolio Exhibition", 2],
      ["Diploma in Multimedia Arts and Design", "4th Year", "2nd Semester", "CAREER 101", "Career Development", 2],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "1st Semester", "COM 101", "Purposive Communication", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "1st Semester", "MATH 101", "Mathematics in the Modern World", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "1st Semester", "IND 101", "Introduction to Industrial Education", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "1st Semester", "HOS 106", "Basic Cookery", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "1st Semester", "CS 101", "Computer Fundamentals", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "1st Semester", "PE 101", "Physical Fitness 1", 2],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "1st Semester", "NSTP 101", "National Service Training Program 1", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "2nd Semester", "PSY 101", "Understanding the Self", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "2nd Semester", "HIST 101", "Philippine History", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "2nd Semester", "HOS 107", "Food Preparation", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "2nd Semester", "HOS 103", "Housekeeping", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "2nd Semester", "HOS 108", "Basic Baking", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "2nd Semester", "PE 102", "Physical Fitness 2", 2],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "1st Year", "2nd Semester", "NSTP 102", "National Service Training Program 2", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "1st Semester", "HOS 209", "Commercial Cooking", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "1st Semester", "HOS 210", "Restaurant Service", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "1st Semester", "HOS 203", "Food Safety and HACCP", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "1st Semester", "NUTR 101", "Nutrition", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "1st Semester", "MATH 201", "Hospitality Mathematics", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "1st Semester", "ENT 101", "Entrepreneurship", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "2nd Semester", "HOS 211", "Front Office Operations", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "2nd Semester", "HOS 212", "Beverage Management", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "2nd Semester", "HOS 103", "Hotel Housekeeping", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "2nd Semester", "HOS 213", "Catering Services", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "2nd Semester", "MKT 101", "Hospitality Marketing", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "2nd Year", "2nd Semester", "EDU 101", "Educational Technology", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "1st Semester", "HOS 214", "Hotel Operations", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "1st Semester", "HOS 215", "Restaurant Management", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "1st Semester", "EDU 201", "Teaching Strategies in Technical Education", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "1st Semester", "EDU 202", "Assessment of Learning", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "1st Semester", "RES 101", "Hospitality Research", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "2nd Semester", "EDU 203", "Instructional Materials Development", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "2nd Semester", "HOS 216", "Hospitality Supervision", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "2nd Semester", "HRM 101", "Human Resource Management", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "2nd Semester", "FEAS 101", "Feasibility Study", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "3rd Year", "2nd Semester", "EDU 204", "Practice Teaching I", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "4th Year", "1st Semester", "EDU 205", "Practice Teaching II", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "4th Year", "1st Semester", "OJT 401", "Internship/OJT", 6],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "4th Year", "1st Semester", "HOS 217", "Hospitality Leadership", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "4th Year", "1st Semester", "IND 201", "School and Industry Partnership", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "4th Year", "2nd Semester", "CAP 401", "Capstone Project", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "4th Year", "2nd Semester", "IND 202", "Industry Immersion", 3],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "4th Year", "2nd Semester", "SEMINAR 201", "Seminar in Hospitality Education", 2],
      ["Diploma in Industrial Education (Major in Hotel and Restaurant Services)", "4th Year", "2nd Semester", "CAREER 101", "Career Development", 2],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "1st Semester", "COM 101", "Purposive Communication", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "1st Semester", "IND 101", "Introduction to Industrial Education", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "1st Semester", "DRAW 101", "Basic Drawing", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "1st Semester", "CS 101", "Computer Fundamentals", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "1st Semester", "DES 101", "Design Principles", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "1st Semester", "PE 101", "Physical Fitness 1", 2],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "1st Semester", "NSTP 101", "National Service Training Program 1", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "2nd Semester", "PSY 101", "Understanding the Self", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "2nd Semester", "ART 101", "Art Appreciation", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "2nd Semester", "DES 103", "Graphic Design Fundamentals", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "2nd Semester", "MDA 104", "Digital Illustration", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "2nd Semester", "PE 102", "Physical Fitness 2", 2],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "1st Year", "2nd Semester", "NSTP 102", "National Service Training Program 2", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "1st Semester", "MDA 201", "Adobe Photoshop", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "1st Semester", "MDA 202", "Adobe Illustrator", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "1st Semester", "MDA 105", "Photography", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "1st Semester", "DES 102", "Typography", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "1st Semester", "EDU 101", "Educational Technology", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "2nd Semester", "MDA 206", "Motion Graphics", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "2nd Semester", "MDA 207", "Video Production", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "2nd Semester", "DES 202", "UI/UX Design", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "2nd Semester", "MDA 106", "Animation Fundamentals", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "2nd Year", "2nd Semester", "ENT 101", "Entrepreneurship", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "1st Semester", "MDA 303", "3D Modeling", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "1st Semester", "MDA 304", "Visual Communication", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "1st Semester", "MDA 305", "Multimedia Production", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "1st Semester", "EDU 201", "Teaching Strategies", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "1st Semester", "RES 101", "Multimedia Research", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "2nd Semester", "EDU 202", "Instructional Design", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "2nd Semester", "WEB 201", "Web Development", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "2nd Semester", "PORT 101", "Portfolio Development", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "2nd Semester", "EDU 203", "Practice Teaching I", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "3rd Year", "2nd Semester", "FEAS 101", "Feasibility Study", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "4th Year", "1st Semester", "EDU 204", "Practice Teaching II", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "4th Year", "1st Semester", "OJT 401", "Internship/OJT", 6],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "4th Year", "1st Semester", "MDA 205", "Multimedia Project Management", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "4th Year", "1st Semester", "IND 203", "Industry Collaboration", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "4th Year", "2nd Semester", "CAP 401", "Capstone Project", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "4th Year", "2nd Semester", "MDA 401", "Multimedia Portfolio Defense", 3],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "4th Year", "2nd Semester", "SEMINAR 301", "Seminar in Digital Media", 2],
      ["Diploma in Industrial Education (Major in Multimedia Arts and Design)", "4th Year", "2nd Semester", "CAREER 101", "Career Development", 2],
    ];

    // Step 1: Create all subjects (unique by code) from curriculumItems
    const subjectMap = {}; // code -> id
    const seenCodes = new Set();
    for (const item of curriculumItems) {
      const [, , , code, title, units] = item;
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        const id = crypto.randomUUID();
        subjectMap[code] = id;
        await run(
          db,
          `INSERT INTO subjects (id, code, title, units, description) VALUES (?, ?, ?, ?, ?)`,
          [id, code, title, Number(units), null]
        );
      }
    }

    // Step 2: Insert into curriculum using subjectId
    for (const item of curriculumItems) {
      const [progName, yearLevel, semester, subjectCode] = item;
      const programId = progIds[progName];
      if (!programId) continue;
      const subjectId = subjectMap[subjectCode];
      if (!subjectId) continue;
      // Check if already exists (should not, but guard)
      const existing = await get(
        db,
        `SELECT id FROM curriculum WHERE programId = ? AND yearLevel = ? AND semester = ? AND subjectId = ?`,
        [programId, yearLevel, semester, subjectId]
      );
      if (!existing) {
        await run(
          db,
          `INSERT INTO curriculum (id, programId, yearLevel, semester, subjectId) VALUES (?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), programId, yearLevel, semester, subjectId]
        );
      }
    }
  }

  // ---- Default Users ----
  const adminExists = await get(db, "SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminExists && process.env.PIAT_ALLOW_DEMO_ACCOUNTS === "true") {
    const now = Date.now();
    const adminId = crypto.randomUUID();
    const adminPassword = hashSeedPassword("admin123");
    await run(
      db,
      `INSERT INTO users (id, userId, username, email, password, firstName, lastName, role, status, createdAt, temporaryPassword)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [adminId, "ADM-00001", "admin", "admin@bwest.edu.ph", adminPassword, "System", "Administrator", "admin", "active", now, "admin123"]
    );
    const defaultUsers = [
      { id: crypto.randomUUID(), userId: "REG-00001", username: "registrar", email: "registrar@example.com", pass: "password", fname: "Maria", lname: "Santos", role: "registrar" },
      { id: crypto.randomUUID(), userId: "FAC-00001", username: "faculty", email: "faculty@example.com", pass: "password", fname: "Ramon", lname: "Cruz", role: "faculty" },
      { id: crypto.randomUUID(), userId: "STU-00001", username: "student", email: "student@example.com", pass: "password", fname: "Anna", lname: "Dela Cruz", role: "student" },
    ];
    for (const u of defaultUsers) {
      await run(
        db,
        `INSERT INTO users (id, userId, username, email, password, firstName, lastName, role, status, createdAt, temporaryPassword)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.userId, u.username, u.email, hashSeedPassword(u.pass), u.fname, u.lname, u.role, "active", now, u.pass]
      );
    }
  }

  // ---- Settings ----
  const settingsExist = await get(db, "SELECT id FROM settings LIMIT 1");
  if (!settingsExist) {
    const now = Date.now();
    const defaults = [
      { key: "schoolName", value: "Philtech Institute Of Arts And Technology", type: "string" },
      { key: "academicYear", value: "2025-2026", type: "string" },
      { key: "semester", value: "1st Semester", type: "string" },
      { key: "enrollmentOpen", value: "true", type: "boolean" },
      { key: "emailNotifications", value: "true", type: "boolean" },
      { key: "maintenanceMode", value: "false", type: "boolean" },
      { key: "autoBackup", value: "true", type: "boolean" },
    ];
    for (const s of defaults) {
      await run(
        db,
        `INSERT INTO settings (id, key, value, type, updatedAt) VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), s.key, s.value, s.type, now]
      );
    }
  }
}
