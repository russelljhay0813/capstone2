# PIAT School Management System: 16-Table Inventory

## Scope and verification

This inventory was checked against the live SQLite database at `backend/piat.db` in read-only mode and cross-checked against the schema initialization in `backend/db.js`. It describes schema only; no row data is included.

All 16 requested tables exist. The live database has 18 application tables in total; `activityLogs` and `settings` are additional tables outside this requested inventory. Three requested names use camelCase identifiers in SQLite rather than the supplied snake_case spelling: `academic_years` is `academicYears`, `academic_records` is `academicRecords`, and `subject_offerings` is `subjectOfferings`. Use the actual identifier when querying the database.

The **Columns** count is the number of fields confirmed by `PRAGMA table_info`. Each table's linked entry in the [PIAT database dictionary](PIAT_DATABASE_DICTIONARY.md) gives the individual columns, SQLite types, nullability, constraints, indexes, and descriptions.

## Requested tables

| # | Requested table | Actual SQLite table | Columns | Primary key | Foreign-key relationships |
|---:|---|---|---:|---|---|
| 1 | `users` — User Table | `users` | 14 | `id` | None |
| 2 | `faculty` — Faculty Table | `faculty` | 11 | `id` | `userId` → `users.id` (cascade delete) |
| 3 | `programs` — Programs Table | `programs` | 5 | `id` | None |
| 4 | `semesters` — Semesters Table | `semesters` | 7 | `id` | `academicYearId` → `academicYears.id` (set null on delete) |
| 5 | `curriculum` — Curriculum Table | `curriculum` | 5 | `id` | `programId` → `programs.id`; `subjectId` → `subjects.id` (cascade delete) |
| 6 | `enrollments` — Enrollment Table | `enrollments` | 5 | `id` | `studentId` → `students.id`; `subjectOfferingId` → `subjectOfferings.id` (cascade delete) |
| 7 | `attendance` — Attendance Table | `attendance` | 7 | `id` | `studentId` → `students.id`; `subjectOfferingId` → `subjectOfferings.id` (cascade delete) |
| 8 | `subjects` — Subjects Table | `subjects` | 5 | `id` | None |
| 9 | `grades` — Grades Table | `grades` | 10 | `id` | `studentId` → `students.id`; `subjectOfferingId` → `subjectOfferings.id` (cascade delete) |
| 10 | `students` — Students Table | `students` | 49 | `id` | `userId` → `users.id` (set null on delete) |
| 11 | `notifications` — Notifications Table | `notifications` | 8 | `id` | `userId` → `users.id` (cascade delete) |
| 12 | `sections` — Sections Table | `sections` | 10 | `id` | `programId` → `programs.id`; `semesterId` → `semesters.id`; `academicYearId` → `academicYears.id` (set null on delete) |
| 13 | `academic_years` — Academic Years Table | `academicYears` | 7 | `id` | None |
| 14 | `academic_records` — Academic Records Table | `academicRecords` | 8 | `id` | `studentId` → `students.id` (cascade); `subjectOfferingId` → `subjectOfferings.id`, `academicYearId` → `academicYears.id`, `semesterId` → `semesters.id` (set null on delete) |
| 15 | `subject_offerings` — Subject Offerings Table | `subjectOfferings` | 11 | `id` | `subjectId` → `subjects.id`, `academicYearId` → `academicYears.id`, `semesterId` → `semesters.id`, `sectionId` → `sections.id` (cascade); `facultyId` → `faculty.id` (set null on delete) |
| 16 | `announcements` — Announcements Table | `announcements` | 11 | `id` | None |

## Individual table entries

The following links open the full per-column definitions in the database dictionary:

1. [users](PIAT_DATABASE_DICTIONARY.md#users)
2. [faculty](PIAT_DATABASE_DICTIONARY.md#faculty)
3. [programs](PIAT_DATABASE_DICTIONARY.md#programs)
4. [semesters](PIAT_DATABASE_DICTIONARY.md#semesters)
5. [curriculum](PIAT_DATABASE_DICTIONARY.md#curriculum)
6. [enrollments](PIAT_DATABASE_DICTIONARY.md#enrollments)
7. [attendance](PIAT_DATABASE_DICTIONARY.md#attendance)
8. [subjects](PIAT_DATABASE_DICTIONARY.md#subjects)
9. [grades](PIAT_DATABASE_DICTIONARY.md#grades)
10. [students](PIAT_DATABASE_DICTIONARY.md#students)
11. [notifications](PIAT_DATABASE_DICTIONARY.md#notifications)
12. [sections](PIAT_DATABASE_DICTIONARY.md#sections)
13. [academicYears](PIAT_DATABASE_DICTIONARY.md#academicyears)
14. [academicRecords](PIAT_DATABASE_DICTIONARY.md#academicrecords)
15. [subjectOfferings](PIAT_DATABASE_DICTIONARY.md#subjectofferings)
16. [announcements](PIAT_DATABASE_DICTIONARY.md#announcements)
