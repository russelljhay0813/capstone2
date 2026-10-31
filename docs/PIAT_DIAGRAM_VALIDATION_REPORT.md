# PIAT System Diagrams — Validation Report

## Scope and method

- Active database path resolved from `backend/db.js`: `backend/piat.db` (`PIAT_DB_PATH` is the optional override).
- The database was inspected with SQLite URI `mode=ro`; no backend process, initialization routine, migration, or test was run against the active database. Its existing worktree modification was preserved.
- Schema evidence: live `sqlite_master`, `PRAGMA table_info`, `PRAGMA foreign_key_list`, `PRAGMA index_list`, `PRAGMA foreign_key_check`, and `PRAGMA quick_check`; compared with the schema creation/migration logic in `backend/db.js`.
- Application evidence: API handlers in `backend/index.js`, web API/services and role dashboards under `src/lib` and `src/routes`, and mobile client/storage/screens under `mobile_build`.
- This report distinguishes central `backend/piat.db` tables from the mobile application's independent local attendance cache.

## Validation summary

| Check | Result | Evidence / limitation |
|---|---|---|
| Active DB identification and read-only inspection | PASS | `backend/db.js` defaults to `backend/piat.db`; read-only SQLite inspection completed. |
| Live table/column inventory compared with ERD | PASS | 18 central tables and 185 columns; DBML table names, column names, and SQLite-declared types were compared with live `PRAGMA` metadata. |
| Declared FK comparison | PASS | 25 declared foreign-key columns/edges; ERD shows all 25 with their actual delete actions. `PRAGMA foreign_key_check` returned 0 violations. |
| Live database structural integrity | PASS | `PRAGMA quick_check` returned `ok`. |
| Unique constraints and explicit indexes | PASS | 20 non-primary-key unique constraints and 24 explicit non-unique indexes were taken from live SQLite metadata and represented in DBML/dictionary. |
| Cross-diagram process/data-store consistency | PASS | Context, Level 0, and Level 1 use the same web/mobile boundary, central tables, and verified workflow distinctions. |
| Database initialization/migration review | PASS | `initDb` enables FK enforcement on the backend connection, creates missing tables/indexes, adds `students.region` when absent, and performs data reconciliation/seed/offering-generation work. These startup actions were not invoked against the active DB. |
| DBML syntax parser | PASS | Parsed in memory with `@dbml/core` 10.3.1 `Parser.parse(..., 'dbml')`. |
| dbdiagram.io import/render | TEST GAP | The source has not been submitted to dbdiagram.io; no successful website import or rendering is claimed. |
| Mermaid renderer | TEST GAP | Mermaid source is present and reviewed for consistent process/data-store flows, but no Mermaid renderer was run. |
| Mobile offline persistence and synchronization | PASS / TEST GAP | Local queue, connectivity listener, bulk API, central authorization and duplicate-key upsert are present (PASS). Offline login, process-death durability, and background delivery were not verified (TEST GAP). |
| End-to-end browser/mobile behavior | TEST GAP | Documentation analysis did not launch the applications or perform live API calls. |

### Schema inventory

- Tables: 18.
- Columns: 185.
- Declared foreign-key edges: 25.
- Explicit non-unique indexes: 24.
- Non-primary-key unique constraints/indexes: 20.
- One-to-one profile links are represented for unique `students.userId` and `faculty.userId`; many-to-many program/subject and student/offering associations are represented by `curriculum` and `enrollments` bridge tables.
- Unresolved/non-FK columns with possible application meaning: `announcements.subjectId` and `notifications.relatedId`. No FK is invented for either.
- The live database's `TEXT PRIMARY KEY` columns are reported by `PRAGMA table_info` without a `NOT NULL` declaration. The dictionary marks these `Yes*`; DBML uses the primary-key notation required by DBML. This is a SQLite/DBML nullability representation caveat, not an added relationship.

The existing `codebase_scan_report.md` architecture sketch says `piat.db` has 17 tables. The live database has 18; the earlier count is stale. No separate `registrations` table exists; registration state and personal data reside in `students`. Student authentication also has a separate `/api/students/login` path using `students.password`; faculty accounts use `users` with a related `faculty` profile.

## Process-to-implementation trace

| DFD process | Frontend route/service | Backend endpoint/handler | Central tables | Result |
|---|---|---|---|---|
| 1. Authentication and User Management | `src/routes/login.tsx`; `src/lib/auth-context.tsx`; `mobile_build/src/screens/login.tsx` | `POST /api/users/login`; `POST /api/students/login`; user administration endpoints in `backend/index.js` | `users`, `students`, `faculty`, `activityLogs` | PASS. Login issues JWT; mobile UI additionally rejects non-faculty accounts. |
| 2. Student Registration and Profile Management | `src/routes/register.tsx`; `src/lib/registrations-store.ts`; `src/routes/dashboard/registrar.registrations.tsx` | `POST /api/students`; `PUT /api/students/:studentId`; `GET /api/students` | `students`, plus enrollment/structure tables on auto-enrollment | TEST GAP. New-student form path calls an endpoint restricted to admin/registrar; complete submitted payloads resolve directly to approved and auto-enroll. Registrar rejection exists; approval helper is not wired to the page. |
| 3. Academic Programs and Curriculum Management | `src/routes/dashboard/registrar.curriculum.tsx`; program/curriculum services in `src/lib/api.ts` | `/api/programs`; `/api/curriculum` | `programs`, `curriculum`, `subjects` | PASS. Curriculum create checks subject existence and duplicate mapping; FKs enforce program/subject links. |
| 4. Subject Offerings and Faculty Assignment | `src/routes/dashboard/registrar.subjects.tsx`; `src/routes/dashboard/registrar.faculty.tsx`; faculty offering pages | `/api/subject-offerings`; `/api/subject-offerings/assign`; `/api/faculty/offerings` | `subjectOfferings`, `subjects`, `academicYears`, `semesters`, `sections`, `faculty`, `users` | PASS. Write endpoints use admin/registrar roles; faculty offering lookup is JWT faculty-only. |
| 5. Enrollment and Re-enrollment | `src/routes/dashboard/registrar.enrollment.tsx`; `src/routes/dashboard/registrar.reenrollment.tsx`; `src/lib/enrollment-store.ts` | `POST/GET /api/enrollments`; `GET /api/students/eligible-for-reenrollment`; `POST /api/students/:studentId/reenroll` | `students`, `subjectOfferings`, `sections`, `curriculum`, `enrollments`, `notifications` | TEST GAP. Ordinary enrollment is protected and validates student/offering existence; re-enrollment write handler has no auth middleware and does not enforce finalized-grade eligibility. |
| 6. Grade Management and Finalization | `src/routes/dashboard/faculty.grades.tsx`; `src/routes/dashboard/registrar.records.tsx`; grade service in `src/lib/api.ts` | `GET/POST/DELETE /api/grades`; `POST /api/students/:studentId/finalize-records` | `grades`, `students`, `subjectOfferings`, `academicYears`, `semesters`, `notifications`, `activityLogs` | PASS / TEST GAP. Faculty assignment and finalizer roles are checked. Grade write does not check student enrollment; finalizer includes any non-finalized grade status, not only submitted records. |
| 7. Attendance Recording and Synchronization | `src/routes/dashboard/faculty.attendance.tsx`; `mobile_build/app/subjects.tsx`; `mobile_build/src/screens/attendance.tsx`; `mobile_build/src/lib/db.ts`, `sync-store.ts` | `GET /api/faculty/offerings`; `GET /api/faculty/subjects/:subjectId/students`; `POST /api/attendance`; `POST /api/attendance/bulk` | Central: `attendance`, `students`, `subjectOfferings`, `enrollments`, `faculty`, `activityLogs`. Mobile local: `offerings`, `students`, `offering_students`, `attendance` | PASS / TEST GAP. Backend checks valid date/status, assignment and enrolled status, and upserts by student/offering/date. Roster endpoint does not filter enrollment status before returning students. |
| 8. Reports, Dashboards, Announcements and Notifications | `src/routes/dashboard/*`; `src/lib/announcements-store.ts`; `src/lib/notifications-store.ts` | `/api/dashboard/*`; `/api/reports/*`; `/api/announcements`; `/api/notifications` | `users`, `students`, academic/attendance/grade tables, `announcements`, `notifications`, `activityLogs`, `settings` | PASS. Dashboard/report routes and announcement/notification read/write handlers are present. |

## Unresolved and application-level relationships

1. `announcements.subjectId` has no declared SQLite FK. The API stores and returns it, but the schema does not validate that it refers to `subjects.id`; the ERD labels it as non-FK and does not draw a relationship.
2. `notifications.relatedId` is an opaque optional value with no FK. Backend callers pass different related records; the target cannot be modeled as one confirmed relationship.
3. Curriculum-to-offering/student enrollment paths are implemented through handlers and joins, while the database only enforces the specific declared FKs. The ERD shows schema FKs only.
4. The mobile `offering_students` local association has a composite primary key but no declared local FK. It is not part of the central DBML.
5. `academicRecords` has declared FK structure but no read/write endpoint was found in the inspected application code; its runtime use requires verification.

## Behavior gaps that affect interpretation

- Registration: `/register` sends a new record to `POST /api/students`, which is role-protected for admin/registrar; the self-service client cannot create an applicant through that path without a privileged token. For an existing student, `PUT /api/students/:studentId` allows the student's own JWT. A complete submitted payload resolves to `approved` and calls auto-enrollment; invalid required fields are rejected. The registrar page implements rejection, but its `approveRegistration` helper is not wired to that page.
- Re-enrollment: the eligibility list is role-protected, but `POST /api/students/:studentId/reenroll` has no role middleware. The server computes the target and builds enrollments from curriculum but does not require approved status or finalized grades.
- Grade entry: faculty must own the offering, but the grade POST handler does not verify an enrollment row. Finalization updates records whose status is anything other than `finalized`, including drafts.
- Mobile roster: `/api/faculty/subjects/:subjectId/students` verifies faculty ownership but does not restrict the roster query to `enrollments.status = 'enrolled'`; attendance submission does require an active `enrolled` row. A dropped/completed row could therefore appear in the local roster and later be rejected by sync.
- Duplicate mobile sync: `localId` is echoed for result correlation only; server-side deduplication is by `(studentId, subjectOfferingId, date)`. Repeated uploads update the existing central attendance record and return `updated`.
- No application behavior or database content was changed for these diagrams.
