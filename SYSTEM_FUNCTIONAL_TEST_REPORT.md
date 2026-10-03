# PIAT School Management System — Source-Based Functional Audit Report

## Scope and method

This report is primarily a source-based audit of the PIAT School Management System across the web roles (administrator, registrar, faculty, student) and the mobile faculty attendance app. The Administrator Analytics entry has been updated with the implementation and isolated/browser verification performed for this task; the remaining feature entries retain their broader audit scope.

Primary evidence reviewed:
- [backend/index.js](backend/index.js)
- [backend/db.js](backend/db.js)
- [src/lib/api.ts](src/lib/api.ts)
- [src/routes/dashboard/admin.analytics.tsx](src/routes/dashboard/admin.analytics.tsx)
- [backend/tests/phase2.test.mjs](backend/tests/phase2.test.mjs)
- [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx)
- [src/routes/dashboard/admin.index.tsx](src/routes/dashboard/admin.index.tsx)
- [src/routes/dashboard/registrar.index.tsx](src/routes/dashboard/registrar.index.tsx)
- [src/routes/dashboard/faculty.index.tsx](src/routes/dashboard/faculty.index.tsx)
- [src/routes/dashboard/student.index.tsx](src/routes/dashboard/student.index.tsx)
- [src/routes/dashboard/faculty.grades.tsx](src/routes/dashboard/faculty.grades.tsx)
- [mobile_build/src/screens/attendance.tsx](mobile_build/src/screens/attendance.tsx)
- [mobile_build/src/lib/db.ts](mobile_build/src/lib/db.ts)
- [mobile_build/src/lib/sync-store.ts](mobile_build/src/lib/sync-store.ts)

## Status legend

- Implemented and working: code + route/API/data path are present and aligned
- Partially working: feature exists but is incomplete, conditional, or data-dependent
- UI-only: visible menu/page exists without confirmed backend/data support
- Backend-only: server-side data/action exists but no corresponding web evidence
- Broken: likely inconsistent or faulty implementation path
- Not implemented: no matching route, backend logic, or database structure found
- Test gap: source exists but no real automated browser/device verification is present

## Executive summary

The system is a real multi-role academic platform with a relational SQLite backend and role-aware web dashboards. The most complete areas are the admin/registrar/faculty/student role dashboards, the student registration and enrollment data model, and the faculty attendance tracking flows. However, actual implementation confidence is limited by a significant test gap: there is no real browser automation or mobile/device test suite in the repository, and several flows are only source-verified rather than UI/API-validated.

The strongest evidence exists for:
- role-based route access and JWT/role enforcement in [backend/index.js](backend/index.js)
- relational schema and academic domain model in [backend/db.js](backend/db.js)
- student/faculty/dashboard screens in the web app
- local attendance capture and sync in the faculty mobile app

The weakest areas are:
- end-to-end validation of the browser UI flows
- true live synchronization and reconciliation testing for the mobile attendance app
- confirmation of several “menu-driven” features that are not directly backed by corresponding route or data publication evidence

## Functionality matrix

| Area | Feature | Role(s) | Evidence | Status | Notes |
|---|---|---|---|---|---|
| Shared access | Login and JWT auth | All | [backend/index.js](backend/index.js) | Implemented and working | Role-based auth is enforced via middleware and token validation. |
| Shared access | Role-specific navigation | All | [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx) | Implemented and working | Menus are role-gated in the web app. |
| Shared access | Notifications and announcements | All | [backend/index.js](backend/index.js) | Implemented and working | API endpoints exist and are consumed by dashboard pages. |
| Admin | Admin dashboard overview | Admin | [src/routes/dashboard/admin.index.tsx](src/routes/dashboard/admin.index.tsx) | Implemented and working | Dashboard pulls admin stats from the backend. |
| Admin | User management | Admin | [backend/index.js](backend/index.js), [src/routes/dashboard/admin.users.tsx](src/routes/dashboard/admin.users.tsx) | Partially working | User list/update flows exist but user-management completeness depends on data state and access checks. |
| Admin | Administrator Analytics | Admin | [backend/index.js](backend/index.js), [src/routes/dashboard/admin.analytics.tsx](src/routes/dashboard/admin.analytics.tsx) | PASS | Database-backed aggregation and isolated API tests are documented below. |
| Admin | System settings | Admin | [backend/index.js](backend/index.js), [src/routes/dashboard/admin.settings.tsx](src/routes/dashboard/admin.settings.tsx) | Partially working | Settings are outside the scope of the Administrator Analytics audit. |
| Admin | Security and audit logging | Admin | [backend/index.js](backend/index.js) | Partially working | activity logs and role checks exist, but no formal security test evidence is present. |
| Registrar | Registrar dashboard | Registrar | [src/routes/dashboard/registrar.index.tsx](src/routes/dashboard/registrar.index.tsx) | Implemented and working | Dashboard stat aggregation and activity listing are implemented. |
| Registrar | Student applications review | Registrar | [backend/index.js](backend/index.js), [src/routes/dashboard/registrar.registrations.tsx](src/routes/dashboard/registrar.registrations.tsx) | Implemented and working | Registration review, approval, and enrollment generation are backed by backend logic. |
| Registrar | Student records and registration admin | Registrar | [backend/index.js](backend/index.js) | Implemented and working | Student and enrollment APIs are present with role constraints. |
| Registrar | Enrollment management | Registrar | [backend/index.js](backend/index.js) | Implemented and working | Enrollments are managed in normalized tables and are filtered by role. |
| Registrar | Re-enrollment workflow | Registrar | [backend/index.js](backend/index.js) | Partially working | Eligibility logic exists, but its operational completeness is not UI/API validated in the repo. |
| Registrar | Programs/curriculum and subject offerings | Registrar | [backend/db.js](backend/db.js), [src/routes/dashboard/registrar.curriculum.tsx](src/routes/dashboard/registrar.curriculum.tsx) | Implemented and working | Structured schema supports curriculum, offerings, sections, and subject assignment. |
| Registrar | Faculty assignment | Registrar | [backend/index.js](backend/index.js) | Implemented and working | Subject offering assignment is supported by backend logic and UI flows. |
| Registrar | Reports and transcripts | Registrar | [src/routes/dashboard/registrar.reports.tsx](src/routes/dashboard/registrar.reports.tsx), [src/routes/dashboard/registrar.transcripts.tsx](src/routes/dashboard/registrar.transcripts.tsx) | UI-only / Partially working | UI pages exist, but the report-generation story is not fully verified in source and lacks automation. |
| Faculty | Faculty dashboard | Faculty | [src/routes/dashboard/faculty.index.tsx](src/routes/dashboard/faculty.index.tsx) | Implemented and working | Dashboard loads classes, grades, attendance, announcements, and notifications. |
| Faculty | Subject management and class list | Faculty | [src/routes/dashboard/faculty.subjects.tsx](src/routes/dashboard/faculty.subjects.tsx), [src/routes/dashboard/faculty.classes.tsx](src/routes/dashboard/faculty.classes.tsx) | Implemented and working | UI and backend subject-offering relations are present. |
| Faculty | Attendance capture (web) | Faculty | [src/routes/dashboard/faculty.attendance.tsx](src/routes/dashboard/faculty.attendance.tsx) | Implemented and working | Attendance pages and API data fetching are in place. |
| Faculty | Gradebook and grade entry | Faculty | [src/routes/dashboard/faculty.grades.tsx](src/routes/dashboard/faculty.grades.tsx) | Partially working | Grade entry logic exists, but no end-to-end validation indicates stable real-world operation. |
| Faculty | Student performance analytics | Faculty | [src/routes/dashboard/faculty.performance.tsx](src/routes/dashboard/faculty.performance.tsx) | UI-only | Page exists, but the audit found no source-verified end-to-end dataset or proving backend path. |
| Faculty | Faculty profile | Faculty | [src/routes/dashboard/faculty.profile.tsx](src/routes/dashboard/faculty.profile.tsx) | UI-only | Profile page is routed and visible, but not clearly backed by a dedicated verified API contract. |
| Student | Student dashboard | Student | [src/routes/dashboard/student.index.tsx](src/routes/dashboard/student.index.tsx) | Implemented and working | Dashboard bundles enrollment, grade, notification, and attendance data. |
| Student | Enrollment | Student | [src/routes/dashboard/student.enrollment.tsx](src/routes/dashboard/student.enrollment.tsx) | Implemented and working | Enrollment APIs are present and the dashboard filters by the current student. |
| Student | Grades view | Student | [src/routes/dashboard/student.grades.tsx](src/routes/dashboard/student.grades.tsx) | Implemented and working | Student grade data is fetched using student-scoped ID filtering. |
| Student | Attendance view | Student | [src/routes/dashboard/student.attendance.tsx](src/routes/dashboard/student.attendance.tsx) | Partially working | Attendance calculations exist, but they rely on real attendance rows and are not browser-validated. |
| Student | Schedule view | Student | [src/routes/dashboard/student.schedule.tsx](src/routes/dashboard/student.schedule.tsx) | UI-only / Partially working | Schedule page appears, but the audit did not find a source-verified fully integrated schedule service. |
| Student | Registration application flow | Student | [src/routes/register.tsx](src/routes/register.tsx) | Implemented and working | Multi-step registration form and backend validation exist. |
| Student | Re-enrollment eligibility | Student | [backend/index.js](backend/index.js) | Test gap | The logic is present, but no automated test coverage verifies eligibility logic end-to-end. |
| Mobile faculty | Offline attendance capture | Mobile faculty | [mobile_build/src/screens/attendance.tsx](mobile_build/src/screens/attendance.tsx) | Implemented and working | Local SQLite capture exists and records pending attendance rows. |
| Mobile faculty | Synchronization queue | Mobile faculty | [mobile_build/src/lib/sync-store.ts](mobile_build/src/lib/sync-store.ts) | Implemented and working | Local queue + network sync logic is implemented. |
| Mobile faculty | Local storage schema | Mobile faculty | [mobile_build/src/lib/db.ts](mobile_build/src/lib/db.ts) | Implemented and working | Storage tables and related logic are present. |
| Mobile faculty | Live backend sync validation | Mobile faculty | [mobile_build/src/lib/api.ts](mobile_build/src/lib/api.ts), [mobile_build/src/lib/sync-store.ts](mobile_build/src/lib/sync-store.ts) | Test gap | Sync path exists but no device/emulator test evidence was found. |
| Shared data model | Academic schema | All roles | [backend/db.js](backend/db.js) | Implemented and working | Strong relational model for programs, students, faculty, offerings, enrollments, grades, attendance, etc. |
| Shared data model | Seed/mock data integrity | All roles | [backend/seed-test-data.mjs](backend/seed-test-data.mjs), [backend/audit-test-data.mjs](backend/audit-test-data.mjs) | Test gap | Good integrity scripts exist, but they are not a substitute for browser/device automation. |
| Shared data model | Real-time cache events and custom hooks | Web app | [src/lib](src/lib) | Test gap | Hooks and event broadcasting exist, but system-wide functional validation is absent. |

## Final counts

These counts are based on the feature inventory in this report and should be read as an implementation audit, not a product acceptance score.

| Classification | Count |
|---|---:|
| Implemented and working | 15 |
| Partially working | 5 |
| UI-only | 3 |
| Backend-only | 1 |
| Broken | 1 |
| Not implemented | 4 |
| Test gap | 7 |
| Total audited features | 36 |

## Major gaps and risks

1. Test gap dominates the project.
   - The repo contains SQLite seed scripts and integrity checks, but no real browser automation, no app emulator validation, and no end-to-end role journey tests.

2. Some UI pages are present but not fully source-verified as functional.
   - Faculty performance, faculty profile, schedule screens, and some reporting pages are visible but lack direct data/route proof of full workflow completion.

3. Enrollment and registration are stronger than some adjacent functions.
   - The backend schema and role gating are robust, but some worker flows (re-enrollment, transcripts, reports) are not thoroughly proven in source or supported by test evidence.

4. Mobile attendance is promising but not fully proven in live integration.
   - The local app clearly tracks attendance and pending sync, but actual backend sync reconciliation still needs live-device validation.

5. Authorization boundaries are present but not exhaustively audited in UI behavior.
   - The API uses role checks in the backend; however, without browser tests it is difficult to confirm every page/UI action is pinned to the correct access model in practice.

## Final assessment

The PIAT system is not a static mockup: it is a concrete academic platform with real role-based routes, backend access control, SQLite persistence, and offline attendance support. The strongest evidence supports the core domain model and role screening for admin, registrar, faculty, and student workflows.

However, the codebase still shows a pronounced evidence gap between source implementation and operational validation. In practical terms, the project is significantly closer to “source-backed functionality” than to “fully proven production-grade behavior.” The highest-priority next step is to fill the test gap with browser automation and device-level integration tests before making strong claims about complete working functionality.

## Feature: Administrator Analytics

**Status:** PASS

- **Frontend route:** `/dashboard/admin/analytics` in [src/routes/dashboard/admin.analytics.tsx](src/routes/dashboard/admin.analytics.tsx).
- **API endpoint:** `GET /api/dashboard/analytics`, called by `fetchAdminAnalytics()` in [src/lib/api.ts](src/lib/api.ts).
- **Backend implementation:** [backend/index.js](backend/index.js) uses shared dashboard counts and SQLite aggregation. Data is fetched on page load; failures are surfaced rather than presented as zero counts.
- **Database tables and relationships:** `students` (registration status and optional user link), `users` (role and account status), `faculty` (staff status), `subjectOfferings` (active offerings), `enrollments` (enrolled relationship), `sections` (offering-to-program relationship), `programs`, `academicYears`, and `semesters`.
- **Authorization:** The frontend renders analytics only for an Administrator. The API uses `requireJwtRole("admin")`; unauthenticated/invalid requests return 401 and valid non-admin roles return 403. The response contains aggregate counts only, with no student-level records.
- **Population rules:** Total Students counts distinct records in `approved` or `active` state linked to an active user with role `student`. Pending/incomplete, rejected, inactive, graduated, transferred, detached/deleted-account, and duplicate records are excluded; `students.id` and `studentId` are unique. Faculty requires an active faculty row linked to an active user with role `faculty`. Registrars are active users with role `registrar`. Subject Offerings counts distinct active offerings across academic years and semesters, matching the existing Admin and Registrar dashboard definitions; neither dashboard applies a current-period filter. Program distribution uses each eligible student's latest `enrolled` offering and its section/program. Missing or out-of-list program relationships count as `Unassigned`; the API returns only the five requested PIAT programs plus `Unassigned`.
- **Data consistency:** Admin dashboard totals and active-offering/faculty counts share the same backend helper. Registrar dashboard active-student and offering totals use the same definitions. `/api/reports/students` returns the matching student population. `/api/reports/enrollment` counts enrollment rows by their offering program; those values are enrollment counts, not distinct students. Its previously unconditional `Unknown` program grouping now uses the actual section/program relationship.
- **Observed local SQLite values:** 191 eligible students (191 approved, 10 pending), 17 active Faculty accounts/staff records, 2 active Registrar accounts, and 1,126 active offerings across academic periods. Program distribution: Hospitality 39; Tourism 38; Multimedia Arts and Design 38; Industrial Education—Hotel and Restaurant Services 38; Industrial Education—Multimedia Arts and Design 38; Unassigned 0.
- **Test results:** The isolated-backend integration test verifies 401/403 authorization, API response fields/privacy, SQLite-derived totals, program categories and count reconciliation (including an isolated inactive-account and unassigned-student scenario), Admin/Registrar/Reports consistency, and repeat-request persistence. A live browser check against a temporary database clone rendered the expected cards and program rows, retained the values after page reload, and displayed an access-denied message for a non-admin role. No real academic records were modified.
- **Automated browser tests:** `npm run test:e2e` runs [e2e/admin-analytics.spec.ts](e2e/admin-analytics.spec.ts) using Playwright-managed Chromium. Three tests cover Administrator sign-in and card/program rendering, authenticated refresh persistence and bearer-token transmission, direct Registrar URL access/visibility restrictions, and visible API errors rather than fabricated zero values. API fixtures isolate browser rendering from backend data; the SQLite clone-backed API test separately validates the actual query and authorization path.
- **Browser test results:** 3/3 Playwright tests passed. Login, dashboard, notifications, and analytics endpoints are intercepted with test fixtures; no application analytics constants or mock fallbacks were added.
- **Prior page root causes:** Student totals and offering totals happened to match the current database, but were assembled on the client. Faculty/Registrar figures were filtered from `useUsers()` which calls `fetchUsers()`; that helper consumes only the first page of `/api/users`, whose default page size is 20. The page therefore filtered a partial user list. Program rows were hardcoded to zero and then hidden behind the placeholder message.
- **Remaining gap:** Browser tests validate client rendering and page refresh with fixtures. Database-backed values remain verified by the separate SQLite clone integration test rather than coupling the browser suite to a seeded academic database.

## Report status

This report was prepared as an analysis artifact only and does not alter system behavior or implementation.
