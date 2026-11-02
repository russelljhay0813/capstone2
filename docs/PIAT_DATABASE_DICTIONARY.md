# PIAT Database Structure and Data Dictionary

## Scope and source

This dictionary describes the live central SQLite database at `backend/piat.db`, opened with SQLite read-only mode. The schema is created/reconciled by `backend/db.js`; no database content was changed for this documentation. It excludes the mobile app local cache, which is a separate SQLite database on native builds.

The live database contains 18 application tables. The requested inventory of 16 tables, including the mapping from requested names to actual SQLite identifiers, is in [PIAT_16_TABLE_INVENTORY.md](PIAT_16_TABLE_INVENTORY.md). The database also contains `activityLogs` and `settings`, which are documented below but are outside that requested inventory.

Nullable is taken from `PRAGMA table_info`. SQLite reports the `TEXT PRIMARY KEY` columns below without the `NOT NULL` flag (`Yes*`); this reflects the declared SQLite schema rather than a stricter ORM convention. The DBML expresses those columns as primary keys. `FK` and unique constraints/indexes are taken from SQLite metadata. Timestamps represented as INTEGER are written by application code using `Date.now()` (milliseconds).

## Tables

### `academicRecords`

Indexes/unique constraints: `idx_academicRecords_offeringId` (subjectOfferingId); `idx_academicRecords_studentId` (studentId).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for this academic-history record. |
| `studentId` | `TEXT` | FK -> students.id ON DELETE CASCADE; NOT NULL | No | Student UUID whose academic history this record summarizes. |
| `subjectOfferingId` | `TEXT` | FK -> subjectOfferings.id ON DELETE SET NULL | Yes | Optional subject offering associated with this history record. |
| `academicYearId` | `TEXT` | FK -> academicYears.id ON DELETE SET NULL | Yes | Optional academic year associated with this history record. |
| `semesterId` | `TEXT` | FK -> semesters.id ON DELETE SET NULL | Yes | Optional semester associated with this history record. |
| `recordType` | `TEXT` | NOT NULL; DEFAULT 'summary'; CHECK (recordType IN ('summary', 'transcript', 'certificate')) | No | Record classification allowed by the schema; a read/write endpoint was not found in the inspected application. |
| `summary` | `TEXT` | None declared | Yes | Purpose and application usage require verification; no read/write endpoint was found in the inspected application. |
| `createdAt` | `INTEGER` | NOT NULL | No | Creation timestamp in Unix milliseconds. |

### `academicYears`

Indexes/unique constraints: UNIQUE (code).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the academic year. |
| `code` | `TEXT` | UNIQUE (code); NOT NULL | No | Unique year code used by academic-year lookups (for example, a year range). |
| `name` | `TEXT` | NOT NULL | No | Display name for the academic year. |
| `startDate` | `TEXT` | None declared | Yes | Optional academic-year start date stored as text. |
| `endDate` | `TEXT` | None declared | Yes | Optional academic-year end date stored as text. |
| `status` | `TEXT` | NOT NULL; DEFAULT 'active'; CHECK (status IN ('active', 'inactive')) | No | Academic-year availability; schema allows active or inactive. |
| `createdAt` | `INTEGER` | NOT NULL | No | Creation timestamp in Unix milliseconds. |

### `activityLogs`

Indexes/unique constraints: `idx_activityLogs_actorId` (actorId).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the activity-log entry. |
| `actorId` | `TEXT` | FK -> users.id ON DELETE CASCADE; NOT NULL | No | User UUID associated with the action; database FK to users.id. |
| `actorName` | `TEXT` | NOT NULL | No | Actor display name captured for the audit entry. |
| `action` | `TEXT` | NOT NULL | No | Short action label recorded by backend activity logging. |
| `details` | `TEXT` | NOT NULL | No | Action-specific context recorded by backend activity logging. |
| `role` | `TEXT` | NOT NULL | No | Role label recorded with the action. |
| `createdAt` | `INTEGER` | NOT NULL | No | Creation timestamp in Unix milliseconds. |

### `announcements`

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the announcement. |
| `title` | `TEXT` | NOT NULL | No | Announcement heading displayed to users. |
| `body` | `TEXT` | NOT NULL | No | Announcement text displayed to users. |
| `category` | `TEXT` | CHECK (category IN ('general', 'academic', 'event', 'urgent')) | Yes | Optional category; schema allows general, academic, event, or urgent. |
| `audience` | `TEXT` | CHECK (audience IN ('all', 'student', 'faculty')) | Yes | Optional audience selector; schema allows all, student, or faculty. |
| `subjectId` | `TEXT` | None declared | Yes | Optional opaque subject identifier; no FK is declared and a target relationship is not enforced. |
| `pinned` | `INTEGER` | DEFAULT 0; CHECK (pinned IN (0, 1)) | Yes | Pin flag, represented as 0 or 1. |
| `authorName` | `TEXT` | None declared | Yes | Author name stored with the announcement. |
| `authorRole` | `TEXT` | None declared | Yes | Author role stored with the announcement. |
| `createdAt` | `INTEGER` | NOT NULL | No | Creation timestamp in Unix milliseconds. |
| `datePosted` | `TEXT` | None declared | Yes | Optional display/posting date stored as text. |

### `attendance`

Indexes/unique constraints: `idx_attendance_date` (date); `idx_attendance_offeringId` (subjectOfferingId); `idx_attendance_studentId` (studentId); UNIQUE (studentId, subjectOfferingId, date).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the attendance row. |
| `studentId` | `TEXT` | FK -> students.id ON DELETE CASCADE; UNIQUE (studentId, subjectOfferingId, date); NOT NULL | No | Student UUID whose attendance is recorded; FK to students.id. |
| `subjectOfferingId` | `TEXT` | FK -> subjectOfferings.id ON DELETE CASCADE; UNIQUE (studentId, subjectOfferingId, date); NOT NULL | No | Offering UUID for the attendance session; FK to subjectOfferings.id. |
| `date` | `TEXT` | UNIQUE (studentId, subjectOfferingId, date); NOT NULL | No | Attendance date stored as an ISO date string. |
| `time` | `TEXT` | None declared | Yes | Optional recorded attendance time as text. |
| `status` | `TEXT` | NOT NULL; CHECK (status IN ('present', 'absent', 'late', 'excused')) | No | Attendance outcome; schema allows present, absent, late, or excused. |
| `updatedAt` | `INTEGER` | NOT NULL | No | Last write timestamp in Unix milliseconds. |

### `curriculum`

Indexes/unique constraints: `idx_curriculum_subjectId` (subjectId); `idx_curriculum_programId` (programId); UNIQUE (programId, yearLevel, semester, subjectId).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the program curriculum mapping. |
| `programId` | `TEXT` | FK -> programs.id ON DELETE CASCADE; UNIQUE (programId, yearLevel, semester, subjectId); NOT NULL | No | Program UUID; FK to programs.id. |
| `yearLevel` | `TEXT` | UNIQUE (programId, yearLevel, semester, subjectId); NOT NULL | No | Year level for which this subject is in the curriculum. |
| `semester` | `TEXT` | UNIQUE (programId, yearLevel, semester, subjectId); NOT NULL | No | Semester label used by curriculum matching logic. |
| `subjectId` | `TEXT` | FK -> subjects.id ON DELETE CASCADE; UNIQUE (programId, yearLevel, semester, subjectId); NOT NULL | No | Subject UUID; FK to subjects.id. |

### `enrollments`

Indexes/unique constraints: `idx_enrollments_offeringId` (subjectOfferingId); `idx_enrollments_studentId` (studentId); UNIQUE (studentId, subjectOfferingId).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the student-offering enrollment. |
| `studentId` | `TEXT` | FK -> students.id ON DELETE CASCADE; UNIQUE (studentId, subjectOfferingId); NOT NULL | No | Student UUID; FK to students.id. |
| `subjectOfferingId` | `TEXT` | FK -> subjectOfferings.id ON DELETE CASCADE; UNIQUE (studentId, subjectOfferingId); NOT NULL | No | Subject offering UUID; FK to subjectOfferings.id. |
| `status` | `TEXT` | NOT NULL; DEFAULT 'enrolled'; CHECK (status IN ('enrolled', 'dropped', 'completed')) | No | Enrollment state; schema allows enrolled, dropped, or completed. |
| `enrolledAt` | `INTEGER` | NOT NULL | No | Enrollment creation timestamp in Unix milliseconds. |

### `faculty`

Indexes/unique constraints: `idx_faculty_userId` (userId); UNIQUE (email); UNIQUE (employeeId); UNIQUE (userId).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the faculty profile. |
| `userId` | `TEXT` | FK -> users.id ON DELETE CASCADE; UNIQUE (userId); NOT NULL | No | Login account UUID; unique FK to users.id. |
| `employeeId` | `TEXT` | UNIQUE (employeeId) | Yes | Optional unique employee identifier. |
| `firstName` | `TEXT` | NOT NULL | No | Faculty given name. |
| `lastName` | `TEXT` | NOT NULL | No | Faculty family name. |
| `middleName` | `TEXT` | None declared | Yes | Optional faculty middle name. |
| `email` | `TEXT` | UNIQUE (email); NOT NULL | No | Unique faculty email address. |
| `department` | `TEXT` | None declared | Yes | Optional department label. |
| `designation` | `TEXT` | None declared | Yes | Optional faculty designation/title. |
| `status` | `TEXT` | NOT NULL; DEFAULT 'active'; CHECK (status IN ('active', 'inactive')) | No | Faculty profile availability; schema allows active or inactive. |
| `createdAt` | `INTEGER` | NOT NULL | No | Profile creation timestamp in Unix milliseconds. |

### `grades`

Indexes/unique constraints: `idx_grades_offeringId` (subjectOfferingId); `idx_grades_studentId` (studentId); UNIQUE (studentId, subjectOfferingId, period, type).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the grade row. |
| `studentId` | `TEXT` | FK -> students.id ON DELETE CASCADE; UNIQUE (studentId, subjectOfferingId, period, type); NOT NULL | No | Student UUID whose grade is recorded; FK to students.id. |
| `subjectOfferingId` | `TEXT` | FK -> subjectOfferings.id ON DELETE CASCADE; UNIQUE (studentId, subjectOfferingId, period, type); NOT NULL | No | Offering UUID for the graded subject; FK to subjectOfferings.id. |
| `grade` | `REAL` | None declared | Yes | Numeric grade value; no range constraint is declared in the table schema. |
| `remarks` | `TEXT` | None declared | Yes | Optional remarks stored with the grade. |
| `period` | `TEXT` | UNIQUE (studentId, subjectOfferingId, period, type); CHECK (period IN ('prelim', 'midterm', 'final', 'overall')) | Yes | Optional grading period; schema allows prelim, midterm, final, or overall. |
| `type` | `TEXT` | UNIQUE (studentId, subjectOfferingId, period, type); CHECK (type IN ('activity', 'quiz', 'exam', 'overall')) | Yes | Optional grade component type; schema allows activity, quiz, exam, or overall. |
| `component` | `TEXT` | None declared | Yes | Optional component label/number used by grade-entry UI. |
| `status` | `TEXT` | NOT NULL; DEFAULT 'draft'; CHECK (status IN ('draft', 'submitted', 'finalized')) | No | Grade workflow state; schema allows draft, submitted, or finalized. |
| `submittedAt` | `INTEGER` | NOT NULL | No | Grade write timestamp in Unix milliseconds. |

### `notifications`

Indexes/unique constraints: `idx_notifications_userId` (userId).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the notification. |
| `userId` | `TEXT` | FK -> users.id ON DELETE CASCADE; NOT NULL | No | Recipient login account UUID; FK to users.id. |
| `type` | `TEXT` | NOT NULL | No | Notification category supplied by backend notification writers. |
| `title` | `TEXT` | NOT NULL | No | Notification heading. |
| `message` | `TEXT` | NOT NULL | No | Notification body text. |
| `read` | `INTEGER` | NOT NULL; DEFAULT 0; CHECK (read IN (0, 1)) | No | Read flag, represented as 0 or 1. |
| `createdAt` | `INTEGER` | NOT NULL | No | Creation timestamp in Unix milliseconds. |
| `relatedId` | `TEXT` | None declared | Yes | Optional opaque related identifier; the schema declares no FK or target table. |

### `programs`

Indexes/unique constraints: UNIQUE (name).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the academic program. |
| `name` | `TEXT` | UNIQUE (name); NOT NULL | No | Unique program name used in student program resolution. |
| `description` | `TEXT` | None declared | Yes | Optional program description. |
| `status` | `TEXT` | NOT NULL; DEFAULT 'active'; CHECK (status IN ('active', 'archived')) | No | Program availability; schema allows active or archived. |
| `createdAt` | `INTEGER` | NOT NULL | No | Creation timestamp in Unix milliseconds. |

### `sections`

Indexes/unique constraints: `idx_sections_academicYearId` (academicYearId); `idx_sections_semesterId` (semesterId); `idx_sections_programId` (programId); UNIQUE (code).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the class section. |
| `code` | `TEXT` | UNIQUE (code); NOT NULL | No | Unique section code. |
| `name` | `TEXT` | NOT NULL | No | Section display name. |
| `programId` | `TEXT` | FK -> programs.id ON DELETE SET NULL | Yes | Optional program UUID; FK to programs.id. |
| `yearLevel` | `TEXT` | None declared | Yes | Optional section year level. |
| `semesterId` | `TEXT` | FK -> semesters.id ON DELETE SET NULL | Yes | Optional semester UUID; FK to semesters.id. |
| `academicYearId` | `TEXT` | FK -> academicYears.id ON DELETE SET NULL | Yes | Optional academic-year UUID; FK to academicYears.id. |
| `capacity` | `INTEGER` | None declared | Yes | Optional section capacity. |
| `status` | `TEXT` | NOT NULL; DEFAULT 'active'; CHECK (status IN ('active', 'inactive')) | No | Section availability; schema allows active or inactive. |
| `createdAt` | `INTEGER` | NOT NULL | No | Creation timestamp in Unix milliseconds. |

### `semesters`

Indexes/unique constraints: `idx_semesters_academicYearId` (academicYearId); UNIQUE (code).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the semester. |
| `code` | `TEXT` | UNIQUE (code); NOT NULL | No | Unique semester code used by curriculum and offering logic. |
| `name` | `TEXT` | NOT NULL | No | Semester display name. |
| `sequence` | `INTEGER` | NOT NULL | No | Semester order/sequence number. |
| `academicYearId` | `TEXT` | FK -> academicYears.id ON DELETE SET NULL | Yes | Optional parent academic-year UUID; FK to academicYears.id. |
| `status` | `TEXT` | NOT NULL; DEFAULT 'active'; CHECK (status IN ('active', 'inactive')) | No | Semester availability; schema allows active or inactive. |
| `createdAt` | `INTEGER` | NOT NULL | No | Creation timestamp in Unix milliseconds. |

### `settings`

Indexes/unique constraints: UNIQUE (key).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the setting row. |
| `key` | `TEXT` | UNIQUE (key); NOT NULL | No | Unique setting key. |
| `value` | `TEXT` | NOT NULL | No | Stored setting value as text. |
| `type` | `TEXT` | NOT NULL; DEFAULT 'string' | No | Setting type label; defaults to string. |
| `updatedAt` | `INTEGER` | NOT NULL | No | Last update timestamp in Unix milliseconds. |

### `students`

Indexes/unique constraints: `idx_students_userId` (userId); UNIQUE (email); UNIQUE (userId); UNIQUE (studentId).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the student profile. |
| `studentId` | `TEXT` | UNIQUE (studentId); NOT NULL | No | Unique human-facing student identifier used in registration and lookups. |
| `userId` | `TEXT` | FK -> users.id ON DELETE SET NULL; UNIQUE (userId) | Yes | Optional linked login account UUID; unique FK to users.id. |
| `firstName` | `TEXT` | NOT NULL | No | Student given name. |
| `lastName` | `TEXT` | NOT NULL | No | Student family name. |
| `middleName` | `TEXT` | None declared | Yes | Optional student middle name. |
| `suffix` | `TEXT` | None declared | Yes | Optional name suffix. |
| `email` | `TEXT` | UNIQUE (email) | Yes | Optional unique student email used by student login. |
| `password` | `TEXT` | NOT NULL | No | Student credential hash; API sanitization omits it from responses. |
| `gender` | `TEXT` | CHECK (gender IN ('Male', 'Female', 'Other')) | Yes | Optional gender; schema allows Male, Female, or Other. |
| `dob` | `TEXT` | None declared | Yes | Optional date of birth stored as text. |
| `civilStatus` | `TEXT` | None declared | Yes | Optional civil-status value supplied by registration. |
| `nationality` | `TEXT` | None declared | Yes | Optional nationality supplied by registration. |
| `religion` | `TEXT` | None declared | Yes | Optional religion supplied by registration. |
| `educationLevel` | `TEXT` | NOT NULL | No | Education level supplied by registration. |
| `previousSchool` | `TEXT` | None declared | Yes | Optional prior school. |
| `lastGrade` | `TEXT` | None declared | Yes | Optional last grade/level supplied by registration. |
| `contactNumber` | `TEXT` | None declared | Yes | Optional student contact number. |
| `address` | `TEXT` | None declared | Yes | Optional student address. |
| `city` | `TEXT` | None declared | Yes | Optional city/municipality. |
| `province` | `TEXT` | None declared | Yes | Optional province. |
| `zip` | `TEXT` | None declared | Yes | Optional postal/ZIP code. |
| `fatherName` | `TEXT` | None declared | Yes | Optional father/parent name. |
| `fatherOccupation` | `TEXT` | None declared | Yes | Optional father occupation. |
| `fatherContact` | `TEXT` | None declared | Yes | Optional father contact number. |
| `motherName` | `TEXT` | None declared | Yes | Optional mother/parent name. |
| `motherOccupation` | `TEXT` | None declared | Yes | Optional mother occupation. |
| `motherContact` | `TEXT` | None declared | Yes | Optional mother contact number. |
| `guardianName` | `TEXT` | None declared | Yes | Optional guardian name. |
| `guardianOccupation` | `TEXT` | None declared | Yes | Optional guardian occupation. |
| `guardianContact` | `TEXT` | None declared | Yes | Optional guardian contact number. |
| `guardianRelation` | `TEXT` | None declared | Yes | Optional guardian relationship label. |
| `parentName` | `TEXT` | None declared | Yes | Optional parent/guardian name used by registration validation. |
| `parentContact` | `TEXT` | None declared | Yes | Optional parent/guardian contact used by registration validation. |
| `parentAddress` | `TEXT` | None declared | Yes | Optional parent/guardian address. |
| `emergencyName` | `TEXT` | None declared | Yes | Optional emergency contact name. |
| `emergencyContact` | `TEXT` | None declared | Yes | Optional emergency contact number. |
| `emergencyAddress` | `TEXT` | None declared | Yes | Optional emergency contact address. |
| `emergencyRelation` | `TEXT` | None declared | Yes | Optional emergency contact relationship. |
| `placeOfBirth` | `TEXT` | None declared | Yes | Optional place of birth. |
| `barangay` | `TEXT` | None declared | Yes | Optional barangay. |
| `parentRelationship` | `TEXT` | None declared | Yes | Optional parent/guardian relationship used by registration validation. |
| `status` | `TEXT` | CHECK (status IN ('active', 'inactive', 'graduated', 'transferred', 'pending', 'approved', 'rejected')) | Yes | Optional registration/lifecycle state; schema allows active, inactive, graduated, transferred, pending, approved, or rejected. |
| `submittedAt` | `INTEGER` | None declared | Yes | Optional registration submission timestamp in Unix milliseconds. |
| `reviewedAt` | `INTEGER` | None declared | Yes | Optional review timestamp; declared INTEGER, though update callers may supply different timestamp formats. |
| `reviewNote` | `TEXT` | None declared | Yes | Optional registrar/admin review note. |
| `firstLoginAt` | `INTEGER` | None declared | Yes | Optional first-login timestamp in Unix milliseconds. |
| `lastLoginAt` | `INTEGER` | None declared | Yes | Optional last-login timestamp in Unix milliseconds. |
| `region` | `TEXT` | None declared | Yes | Optional region; added by the startup schema migration when absent. |

### `subjectOfferings`

Indexes/unique constraints: `idx_subjectOfferings_facultyId` (facultyId); `idx_subjectOfferings_sectionId` (sectionId); `idx_subjectOfferings_semesterId` (semesterId); `idx_subjectOfferings_academicYearId` (academicYearId); `idx_subjectOfferings_subjectId` (subjectId); UNIQUE (subjectId, academicYearId, semesterId, sectionId).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for this scheduled subject instance. |
| `subjectId` | `TEXT` | FK -> subjects.id ON DELETE CASCADE; UNIQUE (subjectId, academicYearId, semesterId, sectionId); NOT NULL | No | Subject UUID; FK to subjects.id. |
| `academicYearId` | `TEXT` | FK -> academicYears.id ON DELETE CASCADE; UNIQUE (subjectId, academicYearId, semesterId, sectionId); NOT NULL | No | Academic-year UUID; FK to academicYears.id. |
| `semesterId` | `TEXT` | FK -> semesters.id ON DELETE CASCADE; UNIQUE (subjectId, academicYearId, semesterId, sectionId); NOT NULL | No | Semester UUID; FK to semesters.id. |
| `sectionId` | `TEXT` | FK -> sections.id ON DELETE CASCADE; UNIQUE (subjectId, academicYearId, semesterId, sectionId); NOT NULL | No | Section UUID; FK to sections.id. |
| `facultyId` | `TEXT` | FK -> faculty.id ON DELETE SET NULL | Yes | Optional assigned faculty UUID; FK to faculty.id. |
| `schedule` | `TEXT` | None declared | Yes | Optional offering schedule text. |
| `room` | `TEXT` | None declared | Yes | Optional room/location text. |
| `capacity` | `INTEGER` | None declared | Yes | Optional offering capacity. |
| `status` | `TEXT` | NOT NULL; DEFAULT 'active'; CHECK (status IN ('active', 'inactive', 'closed')) | No | Offering state; schema allows active, inactive, or closed. |
| `createdAt` | `INTEGER` | NOT NULL | No | Creation timestamp in Unix milliseconds. |

### `subjects`

Indexes/unique constraints: UNIQUE (code).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the subject. |
| `code` | `TEXT` | UNIQUE (code); NOT NULL | No | Unique subject code. |
| `title` | `TEXT` | NOT NULL | No | Subject title. |
| `units` | `INTEGER` | NOT NULL | No | Subject unit count. |
| `description` | `TEXT` | None declared | Yes | Optional subject description. |

### `users`

Indexes/unique constraints: UNIQUE (email); UNIQUE (username); UNIQUE (userId).

| Column | Data type | Key/constraint | Nullable | Description |
|---|---|---|---|---|
| `id` | `TEXT` | PK | Yes* | Primary identifier for the login account. |
| `userId` | `TEXT` | UNIQUE (userId); NOT NULL | No | Unique application-defined user identifier; its distinction from id requires verification. |
| `username` | `TEXT` | UNIQUE (username); NOT NULL | No | Unique username accepted by the login query. |
| `email` | `TEXT` | UNIQUE (email); NOT NULL | No | Unique email accepted by the login query. |
| `password` | `TEXT` | NOT NULL | No | Credential hash; API sanitization omits it from user responses. |
| `firstName` | `TEXT` | NOT NULL | No | Account holder given name. |
| `lastName` | `TEXT` | NOT NULL | No | Account holder family name. |
| `middleName` | `TEXT` | None declared | Yes | Optional account holder middle name. |
| `role` | `TEXT` | NOT NULL; CHECK (role IN ('admin', 'faculty', 'registrar', 'student')) | No | Authorization role; schema allows admin, faculty, registrar, or student. |
| `status` | `TEXT` | NOT NULL; DEFAULT 'active'; CHECK (status IN ('active', 'inactive')) | No | Account availability; schema allows active or inactive. |
| `createdAt` | `INTEGER` | NOT NULL | No | Account creation timestamp in Unix milliseconds. |
| `temporaryPassword` | `TEXT` | None declared | Yes | Optional temporary credential value; exact lifecycle use requires verification. |
| `firstLoginAt` | `INTEGER` | None declared | Yes | Optional first-login timestamp in Unix milliseconds. |
| `lastLoginAt` | `INTEGER` | None declared | Yes | Optional last-login timestamp in Unix milliseconds. |

## Schema-level observations

- `students.userId` and `faculty.userId` link identity/profile rows to `users`; the student/faculty profiles are not separate authentication stores in the web API.
- `enrollments` is the many-to-many bridge between `students` and `subjectOfferings`; the unique constraint is `(studentId, subjectOfferingId)`.
- `curriculum` is the many-to-many bridge between `programs` and `subjects` scoped by `yearLevel` and `semester`.
- `subjectOfferings` links subject, academic year, semester, section, and optional faculty. The database does not enforce that a section program/year/semester agrees with an offering/curriculum row.
- `grades`, `attendance`, and `academicRecords` refer to students and/or offerings using declared FKs as listed above.
- `announcements.subjectId` and `notifications.relatedId` have no FK. Their target relationship is not enforced by the schema; `relatedId` is used as an opaque application value.
- No separate `registrations` table exists: registration/profile/review fields are stored on `students`.
- Index/unique details shown above reflect the live database; primary-key autoindexes are implicit and are not repeated as named indexes.
