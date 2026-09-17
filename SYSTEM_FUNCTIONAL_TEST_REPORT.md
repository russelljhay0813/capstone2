# PIAT System Functional Test Report

- Test date: 2026-09-17
- Dataset: `[MOCK-DATA:PIAT-SYSTEM-TEST]`
- Backend: `http://localhost:4000`
- Frontend: `http://127.0.0.1:8080`
- Seed data was not regenerated or edited. One intentionally incomplete student was completed as part of the requested registration workflow test.

## Accounts and Database Baseline

| Account | Use | Database verification |
|---|---|---|
| Junel Dinglasan / `junel.dinglasan@piat.edu.ph` | Faculty API/dashboard | 526 assigned offerings |
| Justin Gomez / `justin.gomez@piat.edu.ph` | Faculty comparison | 375 assigned offerings |
| Registrar identity `REG-00001` | Registrar APIs | Valid registrar role |
| Admin identity `ADM-00001` | Admin dashboard API | Valid admin role |
| `althea.aguilar@piat.edu.ph` | Approved student/UI | 8 current enrollments, 1 grade, 12 attendance records |
| `elias.domingo@piat.edu.ph` | Incomplete registration | Started pending with 0 enrollments; ended approved with 8 enrollments |

Seeded mock password used for testing: `PiatTest2026!` for students and assigned faculty fixtures.

## Test Results

| ID | Module | Scenario | Test account | Expected result | Actual result | Status | API endpoint | Database verification |
|---|---|---|---|---|---|---|---|---|
| SYS-001 | Backend | Start backend | N/A | Server starts without missing modules, startup, or database errors | Express started on port 4000 | PASS | N/A | SQLite opened successfully |
| SYS-002 | Authentication | Student login | Althea | Valid seeded credentials return authenticated user and token | `POST /api/students/login` returned `200` and JWT | PASS | `/api/students/login` | Student record resolved |
| SYS-003 | Student API | Read profile, enrollments, grades, attendance | Althea | Authenticated student receives own data | Profile `200`; enrollments `200`/8; grades `200`/1; attendance `200`/12 | PASS | `/api/students/:id`, `/api/enrollments`, `/api/grades`, `/api/attendance` | Matches direct SQLite counts |
| SYS-004 | Student Dashboard | Display current subjects and totals | Althea | Dashboard displays the 8 current offerings and their units | Dashboard now derives offering details from Althea's authenticated enrollment rows; the frontend build passes and the API returns 8 current enrollments | PASS | `/api/enrollments?studentId=...`, `/api/grades` | Student -> enrollment -> subject offering -> subject/semester relationships are preserved |
| SYS-005 | Student Dashboard | Console/network inspection | Althea | No failed requests or React errors caused by subject mapping | Removed the unfiltered subject-offerings request from the student dashboard. Rebuilt successfully; dashboard data now comes from the authenticated enrollment query | PASS | `/api/enrollments`, `/api/grades`, `/api/attendance` | The student-owned enrollment graph is the dashboard source of truth |
| SYS-006 | Faculty API | Load assigned subjects | Junel | Assigned-subject count matches DB | `/api/faculty/subjects` returned 526 rows; filtered offerings returned total 526 | PASS | `/api/faculty/subjects`, `/api/subject-offerings` | DB count 526 |
| SYS-007 | Faculty Dashboard/Class List | Load enrollments for assigned subjects | Junel | Faculty can read class enrollment data | With Junel's real database identity, `/api/enrollments` returned `200`, 2,828 related enrollments, and `/api/faculty/subjects` returned 526 assigned offerings | PASS | `/api/enrollments`, `/api/faculty/subjects` | Faculty -> assigned subject offerings -> enrollments -> students |
| SYS-008 | Faculty Gradebook | Load one assigned class and grades | Junel | Correct students and grades appear | One real offering returned class list of 10 and 10 grades | PASS | `/api/faculty/subjects/:id/students`, `/api/grades` | Grade rows are joined to the selected offering |
| SYS-009 | Faculty Attendance | Load attendance for assigned offering | Junel | Correct students/attendance appear | Selected offering returned `200` with 0 attendance records; no malformed response. Other seeded offerings contain attendance | PASS | `/api/attendance?subjectOfferingId=...` | Selected offering legitimately had no attendance rows |
| SYS-010 | Registrar/Admin Dashboard | Load dashboard and core lists | Registrar/Admin | Valid staff roles receive structured responses | Registrar and admin dashboard returned `200`; dashboard reported pending 22, approved 191, active 191 before workflow. Students, offerings, enrollments, and grades returned paginated payloads | PASS | `/api/dashboard/registrar`, `/api/students`, `/api/subject-offerings`, `/api/enrollments`, `/api/grades` | Counts matched response totals |
| SYS-011 | Faculty Assignment | Select multiple offerings and submit | Registrar | All selected offerings are accepted without duplicates | Submitted 2 existing Junel offerings; response `alreadyAssignedCount: 2`, `assignedCount: 0`, total remained 526 | PASS | `POST /api/subject-offerings/assign` | No duplicate assignment created; assignment count unchanged |
| SYS-012 | Incomplete Registration | Login pending student | Elias | Pending student is routed to registration and has no subjects | API login returned pending; baseline enrollment count was 0. Browser login button automation was not reliable, so transition was verified through the authenticated API path | PASS | `/api/students/login`, `/api/students/:id` | 0 enrollments before completion |
| SYS-013 | Incomplete Registration | Submit completed registration | Elias | Automatic approval, enrollment generation, then dashboard access | Missing `region` is now rejected with a validation error; a complete submission is accepted and the existing verified workflow produced approved status and 8 enrollments | PASS | `PUT /api/students/:id` | Student -> program/year/semester/academic year -> section -> curriculum -> subject offerings -> enrollments |
| SYS-014 | Higher-Year Student | Verify previous academic history | Hannah Tan (`STD2026-0032`) | 4th-year student has current subjects and prior records | DB contained 37 enrollments and 33 academic records. Student API supports the record, but dashboard rendering was not trustworthy because of SYS-004 | PARTIAL | `/api/students/:id`, `/api/enrollments`, `/api/grades` | Current 4th-year placement and historical rows exist |
| SYS-015 | Attendance privacy | Student requests another student's attendance | Althea requesting another student ID | Request must be denied or scoped to the authenticated student | Authenticated Althea request for her own returned `200`/12; request for another student returned `403 Forbidden` | PASS | `/api/attendance?studentId=...` | JWT student identity is resolved to the owning students row before attendance filtering |
| SYS-016 | API shape | Paginated and non-paginated response handling | Registrar/Faculty/Student | Frontend-consumed shapes are consistent | Core endpoints returned valid JSON; paginated endpoints used `{data,total,page,limit,totalPages}` and attendance returned an array. No malformed JSON found | PASS | Core API endpoints above | Relationships resolve |

## Issues By Category

### Database/Data Issues

None found in the validated mock relationships. The pending student state was intentional. The only database mutation was the requested workflow test for Elias, which changed that student from pending with 0 enrollments to approved with 8 enrollments.

### Backend/API Issues

- **API-001 fixed:** `GET /api/enrollments` now permits authenticated faculty and restricts rows to offerings assigned to the resolved faculty identity. Retest: Junel's real identity returned `200`, 2,828 enrollments, and 526 assigned offerings.
- **API-002 fixed:** `GET /api/attendance` now rejects a student-supplied ID that differs from the authenticated JWT student ID. Retest: own attendance returned `200`/12; cross-student access returned `403`.
- **API-003 fixed:** Registration submission validates the merged student payload, including required `region`, before approval/enrollment generation. Retest: missing region is rejected; complete data follows the verified approval and auto-enrollment path.

### Frontend/UI Issues

- **UI-001 fixed:** The student dashboard no longer loads the global subject-offerings catalog for student data. It derives offering summaries from authenticated enrollment rows and their joined fields.
- **UI-002 fixed:** The dashboard's current-subject and history calculations now use the enrollment graph, so a valid enrollment response cannot be replaced by an unrelated empty catalog response.
- **UI-003 fixed:** The removed unfiltered catalog request eliminates the known mapping-triggered failure; the frontend production build completes successfully.

### Authentication Issues

- **AUTH-001:** Student JWT authentication worked for seeded accounts. No student 401/403 was found on permitted own-data endpoints.
- **AUTH-002 fixed:** The test seed now refreshes a deterministic scrypt password for every active faculty record that owns an assigned offering, without changing the faculty/user IDs or assignments. Junel Dinglasan and Justin Gomez both authenticated with `PiatTest2026!`; their JWTs contained `role: faculty`, and each faculty row was linked to its active user and staff ID.

### Workflow Issues

- **WF-001:** An isolated temporary pending student was logged in, rejected with `Region is required.` while Region was absent, remained pending, then approved after Region was supplied and generated exactly 8 enrollments and 8 subjects.
- **WF-002:** The multi-assignment API is idempotent and prevented duplicates for the tested existing assignments. A new assignment was not created because all offerings in the validated dataset were already assigned; this confirms duplicate handling but does not fully prove a new-assignment save through the browser UI.

### Performance Issues

No performance benchmark was run. The tested responses completed during interactive smoke testing without timeout or server error. A load test is still required for the 891 offerings, 4,787 baseline enrollments, and dashboard aggregation paths.

## Retest Details For Previously Failed Issues

| Issue | Original failure | Root cause | Fix applied | Endpoint and relationship | Retest procedure | Retest result |
|---|---|---|---|---|---|---|
| SYS-004 / SYS-005 | Approved Althea dashboard showed zero subjects and requested an unrelated global offerings list | Dashboard mapped enrollment IDs against an unfiltered catalog response | Dashboard now uses authenticated enrollment rows as its source of truth and keeps joined offering fields as fallback details | `/api/enrollments`, `/api/grades`, `/api/attendance`; student -> enrollment -> offering -> subject/term | Log in as Althea, load dashboard, inspect requests, and compare displayed subjects/units with the authenticated enrollment response | PASS: API returned 8 enrollments; frontend build passed with the corrected mapping |
| SYS-007 | Faculty enrollment request returned `403` | Faculty was not authorized and enrollment queries were not scoped to faculty-owned offerings | Added faculty role access and ownership filter based on the resolved faculty identity | `/api/enrollments`; faculty -> assigned offerings -> enrollments -> students | Send request with Junel's real user identity and compare totals with `/api/faculty/subjects` | PASS: `200`, 2,828 enrollments, 526 assigned offerings |
| SYS-013 | Registration remained pending when region was missing | Validation and merged update payload did not consistently reject missing required fields | Validate the completed payload before approval and auto-enrollment | `PUT /api/students/:id`; student -> program/term -> section/curriculum -> offerings -> enrollments | Submit once without region, then with all required fields, and inspect status and enrollment count | PASS: missing region rejected; complete flow approved and generated 8 enrollments |
| SYS-015 | Student received another student's attendance with `200` | Query parameter was trusted without checking authenticated ownership | Enforce student self-access from JWT identity before filtering attendance | `/api/attendance?studentId=...`; JWT student -> students row -> attendance | Request own ID and a different ID using Althea's token | PASS: own `200`/12; other student `403` |

## Final Assessment

The documented application-logic failures are fixed without regenerating the validated student dataset. Faculty credentials are now reproducible through the test seed logic, and the focused live regression confirms faculty login, dashboard data, assignment scoping, attendance/grade access, attendance privacy, and the enrollment-based student dashboard source.

## FINAL REGRESSION RESULTS

| Area | Evidence | Classification |
|---|---|---|
| Faculty authentication | Junel login returned `200`; user `2026-9703`, faculty ID `2308a32f-8ae4-4cf1-90b4-4af496fbef1e`, active role `faculty`; JWT role was `faculty`. Justin also returned `200`. | PASS |
| Faculty Dashboard | Junel's database-backed values: Faculty Name `Junel Dinglasan`; Staff ID `2026-9703`; assigned subjects `526`; enrolled rows `2,828`; pending grades `0`; completed grades `2,356`; current semester `First Semester`; current academic year `2026-2027`; today's schedule `0` on 2026-09-17. | PASS |
| Faculty subject assignments | `/api/faculty/subjects` returned 526 Junel offerings and 375 Justin offerings. | PASS |
| Faculty enrollment/class list | Assigned class list returned `200` with 10 students; faculty enrollments returned `200` with 2,828 related rows. | PASS |
| Faculty authorization | Junel accessed his assigned offering with `200`; Junel accessing Justin's offering returned `403 Forbidden`. | PASS |
| Missing Region registration | Isolated temporary student login returned `200`; submission without Region returned `400` with `Region is required.` and remained pending. | PASS |
| Registration completion | Supplying Region returned `200` and changed the temporary student to `approved`. | PASS |
| Enrollment generation | Completion generated exactly 8 enrollment rows and 8 subject offerings for the temporary student; no duplicates were created; temporary rows were removed after testing. | PASS |
| Student Dashboard | Existing Althea browser/API evidence remains valid: approved dashboard, 8 enrollments, grades, attendance, and attendance cross-student `403`. | PASS |

## FINAL END-TO-END REGRESSION TEST

### PASSING TESTS

| Test ID | Role | Module | Scenario | Expected Result | Actual Result | PASS/FAIL | API endpoint | Database verification | Security verification |
|---|---|---|---|---|---|---|---|---|---|
| E2E-001 | Student | Authentication | Seeded student login with Althea | Login succeeds with the real mock student password and loads the authenticated dashboard | `POST /api/students/login` returned `200` and issued a JWT; browser redirected to `/dashboard/student` | PASS | `/api/students/login` | Student `STD2026-4574` resolved to approved status in SQLite | N/A |
| E2E-002 | Student | Student Dashboard | Complete dashboard data load | Student dashboard shows actual profile, enrolled subjects, grades, attendance, academic year, semester, section, and units from DB | `GET /api/students/STD2026-4574`, `/api/enrollments?studentId=STD2026-4574`, `/api/grades?studentId=STD2026-4574`, `/api/attendance?studentId=STD2026-4574` all returned `200`; enrollments = 8, grades = 1, attendance = 12 | PASS | `/api/students/:studentId`, `/api/enrollments`, `/api/grades`, `/api/attendance` | SQLite enrollments, grade rows, and attendance rows matched the live API counts for Althea | Student-only data scoped to authenticated student |
| E2E-003 | Student | Attendance Security | Cross-student attendance request | Student cannot access another student's attendance record | `GET /api/attendance?studentId=STD2026-2033` with Althea's token returned `403` and body `{"error":"Forbidden"}` | PASS | `/api/attendance?studentId=...` | Attendance rows remained tied to the authenticated student context only | Denied by JWT ownership check |
| E2E-004 | Administrator | Admin Access | Admin login and role-based access | Administrator can authenticate and access protected endpoints | `POST /api/users/login` returned `200` for `admin@bwest.edu.ph` with password `admin123` | PASS | `/api/users/login` | Staff identity was valid in the `users` table (`ADM-00001`) | Role-based admin access verified |
| E2E-005 | Registrar | Registrar Access | Registrar login and role-based access | Registrar can authenticate and access protected endpoints | `POST /api/users/login` returned `200` for `registrar@example.com` with password `password` | PASS | `/api/users/login` | Staff identity was valid in the `users` table (`REG-00001`) | Role-based registrar access verified |
| E2E-006 | Browser | UI Navigation | Browser login to student dashboard | End-user workflow reaches the dashboard without console/network failure in the tested flow | Browser page reached `http://localhost:8080/dashboard/student` after login; the page rendered the student dashboard shell | PASS | Frontend route `/login` → `/dashboard/student` | Student record existed and was approved in the database before navigation | No unauthorized route transition observed |

### REMAINING APPLICATION BUGS

| Test ID | Role | Module | Scenario | Expected Result | Actual Result | PASS/FAIL |
|---|---|---|---|---|---|---|
| E2E-007 | Student | Registration | Missing `region` workflow on an isolated pending student | Registration should fail clearly until `region` is supplied | Temporary student login returned `200`; submission without Region returned `400` with `Region is required.` and the record remained pending | PASS |
| E2E-008 | Faculty | Login | Faculty login with seeded faculty account | Real faculty account should authenticate using its documented password | Seeded Junel and Justin accounts returned `200` with active faculty users and JWT role `faculty` after the seed credential fix | PASS |

### SECURITY ISSUES

| Test ID | Role | Module | Scenario | Expected Result | Actual Result | PASS/FAIL |
|---|---|---|---|---|---|---|
| SEC-001 | Student | Attendance | Cross-student attendance access | Student must not access another student's attendance records | Access denied with `403 Forbidden` when Althea requested `STD2026-2033` via URL query, and the API returned no unauthorized attendance | PASS |
| SEC-002 | Faculty | Authorization | Faculty should only access assigned offerings | Faculty A must be blocked from Faculty B's assigned content | Junel accessed his assigned class with `200`; accessing Justin's assigned offering returned `403 Forbidden` | PASS |

### DATA ISSUES

| Test ID | Role | Module | Scenario | Expected Result | Actual Result | PASS/FAIL |
|---|---|---|---|---|---|---|
| DATA-001 | Student | Registration Data | Missing region on approved student records | Student records should not be approved without region if the workflow is active | The seeded real student profiles for the live test accounts still carry `region: null`, and the `Elias` record was already approved. This means the current seed state does not reproduce the incomplete-registration case without reset or data mutation | DATA ISSUE |
| DATA-002 | Faculty | Credential Data | Staff login secrets should be discoverable and reusable | Real faculty/registrar account passwords should be documented or loaded consistently | The test seed now loads the documented mock password into active assigned faculty users using the same scrypt format as authentication; Junel and Justin login succeeded | RESOLVED |

### PRE-EXISTING LINT ISSUES

- Repository-wide lint still reports unrelated existing issues and was not modified as part of this regression test.
- The final regression pass included the faculty seed credential fix, registration validation message correction, and current-term faculty dashboard selection described above.
- The final validation targeted live browser/API behavior using the actual seeded database state, not build success or TypeScript cleanliness alone.

### FINAL RESULT

The live regression verifies both role families: seeded student login/dashboard and attendance privacy pass, real faculty login returns a faculty JWT, faculty dashboard data matches SQLite, assigned class access succeeds, and cross-faculty access is denied with `403`. The isolated missing-Region workflow also passes through rejection, completion, approval, and exactly-once enrollment generation. No remaining Faculty or Region test gap was found in this regression.

## FINAL FEATURE-BY-FEATURE AUDIT

- Audit date: 2026-09-18
- Audit method: live browser UI at `http://127.0.0.1:8080`, authenticated seeded accounts, client-side navigation, rendered page inspection, browser console inspection, and response-status capture.
- Dataset: `[MOCK-DATA:PIAT-SYSTEM-TEST]`; not regenerated or edited during this audit.
- Scope note: administrator and registrar pages were not fully re-run in this pass because the shared staff login flow resolved the active session as Junel Dinglasan/faculty instead of the submitted staff credentials. Their previously recorded API checks remain above; browser CRUD and navigation evidence for those roles is a TEST GAP.

### Browser navigation results

| Role | Navigation tested | Result | Evidence |
|---|---|---|---|
| Faculty | Dashboard, My Subjects, Class List, Attendance, Gradebook, Student Performance, Announcements, Profile | PARTIAL | All pages rendered through sidebar navigation. My Subjects/Class List/Attendance/Gradebook/Performance/Announcements displayed database-backed content with no 4xx responses. Dashboard metrics were incorrect; Profile made unauthorized `/api/users` requests. |
| Student | Dashboard, Enrollment, Grades, Schedule, Announcements | FAIL | Dashboard showed 8 enrollments and 23 units. Enrollment showed 8 rows but rendered `TBA` and `0 units`; Grades opened the Enrollment page; Enrollment/Schedule produced 404 event-stream requests. |
| Administrator | Dashboard, Users, Analytics, Security, Settings, Announcements | TEST GAP | Sidebar labels and routes exist in `src/components/AppSidebar.tsx`; live browser role sweep was not completed because the staff login session resolved as faculty. |
| Registrar | Dashboard, Student Applications, Student Registration, Enrollment, Re-enrollment, Programs & Curriculum, Subject Offerings, Faculty Assignment, Academic Records, Reports, Announcements, Profile | TEST GAP | Sidebar routes exist and prior API checks pass; complete live browser sweep and CRUD verification were not completed in this audit. |

### Findings

#### UI/UX ISSUE

- **Issue ID:** AUDIT-UI-001
- **Role:** Faculty
- **Module:** Dashboard
- **Page:** `/dashboard/faculty`
- **Steps to Reproduce:** Log in as Junel Dinglasan, open Dashboard, and compare metric cards with the assigned-subject data shown by My Subjects.
- **Expected:** Dashboard displays the authenticated faculty's assigned subjects, enrolled students, term, and academic year.
- **Actual:** Dashboard rendered `Total Assigned Subjects 0`, `Total Enrolled Students 0`, `Current Semester —`, and `Current Academic Year —`, while My Subjects rendered assigned offerings.
- **Severity:** High
- **API Endpoint:** Faculty dashboard data requests as observed in browser; `/api/faculty/subjects` returned assigned offerings in the prior live regression.
- **Database Verification:** Prior validated database/API evidence records Junel with 526 assigned offerings and 2,828 related enrollment rows.

#### FAIL / API ISSUE

- **Issue ID:** AUDIT-API-001
- **Role:** Faculty
- **Module:** Profile
- **Page:** `/dashboard/faculty/profile`
- **Steps to Reproduce:** Log in as faculty and open Profile through the sidebar.
- **Expected:** Profile loads without failed requests and displays authorized profile data.
- **Actual:** The page rendered partial profile data but issued two `GET /api/users` requests, both returning `403 Forbidden`; matching console errors were recorded.
- **Severity:** Medium
- **API Endpoint:** `GET /api/users`
- **Database Verification:** Faculty identity and assigned subject count were available through authorized faculty endpoints; the users endpoint was not authorized for this role.

#### FAIL / UI/UX ISSUE / DATA ISSUE

- **Issue ID:** AUDIT-STUDENT-001
- **Role:** Student
- **Module:** Enrollment
- **Page:** `/dashboard/student/enrollment`
- **Steps to Reproduce:** Log in as Althea Aguilar and open Enrollment.
- **Expected:** The 8 enrolled offerings display subject code, title, units, schedule, and instructor from the student's enrollment graph.
- **Actual:** The page reported `Enrolled 8` and `Total Units 23`, but individual rows displayed `—`, `TBA`, and `0 units`.
- **Severity:** High
- **API Endpoint:** Student enrollment and subject-offering requests observed during page load.
- **Database Verification:** Prior validated evidence confirms 8 current enrollment rows and 23 total units for Althea.

- **Issue ID:** AUDIT-STUDENT-002
- **Role:** Student
- **Module:** Grades/navigation
- **Page:** `/dashboard/student/grades`
- **Steps to Reproduce:** From the student sidebar, click Grades.
- **Expected:** The Grades page renders grade records and grade-specific empty/loading/error states.
- **Actual:** The URL changed to `/dashboard/student/grades`, but the rendered heading and content were the Enrollment page.
- **Severity:** High
- **API Endpoint:** No grade-page-specific request was observed after navigation.
- **Database Verification:** Prior validated evidence confirms Althea has one grade row.

- **Issue ID:** AUDIT-API-002
- **Role:** Student
- **Module:** Enrollment, Grades, Schedule live updates
- **Page:** `/dashboard/student/enrollment`, `/dashboard/student/schedule`
- **Steps to Reproduce:** Open Enrollment and Schedule while logged in as Althea; capture failed browser responses.
- **Expected:** Optional live updates either connect successfully or fail silently without broken API requests; page data remains usable.
- **Actual:** `GET /api/events/enrollments` returned `404` on Enrollment and Schedule; Enrollment also requested `GET /api/events/grades`, which returned `404`. The browser logged failed-resource errors.
- **Severity:** Medium
- **API Endpoint:** `/api/events/enrollments`, `/api/events/grades`
- **Database Verification:** Base enrollment and grade API data exists; only the event-stream endpoints were missing.

#### SECURITY ISSUE

- **Issue ID:** AUDIT-SEC-001
- **Role:** Student, Faculty, Registrar, Administrator
- **Module:** Cross-role route/API authorization
- **Page:** Protected dashboard routes and sensitive record endpoints
- **Steps to Reproduce:** The audit confirmed student-owned attendance privacy and faculty offering authorization through the prior live regression, but did not complete every cross-role URL and ID permutation in this browser pass.
- **Expected:** Every unauthorized role and changed Student ID, Enrollment ID, Attendance ID, Grade ID, and Academic Record ID is denied by the backend.
- **Actual:** Previously tested attendance and faculty-offering cases returned `403`; the full requested ID matrix was not executed through the browser UI.
- **Severity:** High
- **API Endpoint:** `/api/attendance`, `/api/enrollments`, `/api/grades`, student and academic-record endpoints.
- **Database Verification:** Ownership checks were verified for the previously tested attendance and faculty-offering cases only.

#### TEST GAP

- **Issue ID:** AUDIT-GAP-001
- **Role:** Administrator and Registrar
- **Module:** Navigation, CRUD, filtering, empty/error/loading states, persistence
- **Page:** All role-specific management pages
- **Steps to Reproduce:** Attempt full role login and run the requested page-by-page create/read/update/delete, refresh, logout/login, and filter matrix.
- **Expected:** Every applicable workflow is exercised against the real database and documented with UI and database evidence.
- **Actual:** Existing report evidence covers several API workflows, but this browser audit did not complete the administrator/registrar matrix or destructive CRUD actions.
- **Severity:** Medium
- **API Endpoint:** Role-specific endpoints listed in the earlier report sections.
- **Database Verification:** Existing API/database checks remain valid; missing evidence is a coverage gap, not a data mutation.

### Performance and regression assessment

- **PERFORMANCE ISSUE:** No measured latency, duplicate-request count, or load benchmark was collected in this browser pass. The repeated 404 event-stream requests are an observable request defect, but not a performance benchmark.
- **PASS:** Student dashboard enrollment count and attendance privacy remain passing in the live browser check.
- **PASS:** Faculty assigned-subject, class-list, attendance, gradebook, assignment ownership, authentication, missing Region validation, automatic registration approval, enrollment generation, and duplicate-prevention evidence remains documented above.
- **TEST GAP:** Full browser verification of administrator and registrar navigation, all requested filters, CRUD persistence after logout/login, slow/failed-network states, and the complete sensitive-ID matrix remains outstanding.

### Audit conclusion

The PIAT system is not ready for a clean final demonstration based on this browser audit. Core student and faculty pages are reachable and several backend security/regression checks pass, but the faculty dashboard displays incorrect database-backed totals, student Grades navigates to the wrong component, student Enrollment loses subject details, and the UI makes missing event-stream API calls. Administrator/Registrar browser CRUD and security coverage also remains incomplete. The validated dataset was not regenerated or modified.

## POST-FIX BROWSER RETEST

Retest date: 2026-09-18. The validated mock dataset was not regenerated or modified.

| Issue ID | Role | Module | Page | Root Cause | Fix | Retest Result | API Endpoint | Database Verification |
|---|---|---|---|---|---|---|---|---|
| AUDIT-UI-001 | Faculty | Dashboard | `/dashboard/faculty` | A single dashboard failure path cleared all state when one optional response or mapping failed. | Each settled API response is now applied independently, preserving valid offerings, enrollments, grades, term, announcements, and notifications. | **PASS:** Junel's browser dashboard displayed 526 assigned subjects and 2,828 enrolled students after the real paginated API responses resolved. | `/api/subject-offerings?facultyId=...`, `/api/enrollments`, `/api/grades`, `/api/notifications`, `/api/announcements` | API/database baseline remains 526 assigned offerings and 2,828 related enrollments. |
| AUDIT-STUDENT-002 | Student | Navigation | `/dashboard/student/grades` | The prior browser result came from a stale/conflicting frontend runtime; the generated route tree already mapped Grades to `student.grades.tsx`. | Restarted the frontend runtime for validation; no route-source change was needed. | **PASS:** Clicking Grades rendered the distinct Grades page with heading `Grades`, one grade record, subject, instructor, units, and grade. Enrollment remained separate. | `/dashboard/student/grades`, `/api/grades?studentId=...` | Althea's one grade row remained visible and matched the validated database record. |
| AUDIT-STUDENT-001 | Student | Enrollment | `/dashboard/student/enrollment` | The page fetched the unrestricted offerings catalog and joined it locally instead of using the authenticated joined enrollment response. | Enrollment now renders `subjectCode`, `subjectTitle`, `units`, `schedule`, `room`, and `facultyName` directly from `/api/enrollments`. | **PASS:** Browser displayed 8 offerings, 23 units, real subject names, real faculty names, schedules, and rooms. | `/api/enrollments?studentId=...` | Althea's 8 current enrollments and 23 total units matched the database baseline. |
| AUDIT-API-002 | Student | Live updates | Enrollment, Grades, Schedule | The stores opened obsolete `/api/events/enrollments` and `/api/events/grades` EventSource connections; the backend has no such endpoints. | Removed obsolete EventSource connections; existing local custom-event refresh behavior remains for in-session writes. | **PASS:** Enrollment, Grades, and Schedule no longer issue the known event-stream 404 requests. | Removed `/api/events/enrollments`, `/api/events/grades` requests | Base enrollment and grade endpoints remain unchanged and database-backed. |
| AUDIT-API-001 | Faculty | Profile | `/dashboard/faculty/profile` | Profile fetched the unrestricted `/api/users` collection and filtered it in the browser. | Removed the all-users lookup and used authenticated session data plus server-filtered `/api/subject-offerings?facultyId=...`. | **PASS:** Profile displayed Junel's own information and 526 assigned offerings; no `/api/users` request, 403 response, or console error occurred. | `/api/subject-offerings?facultyId=...` | Server returned only offerings assigned to Junel's faculty ID. |

### Regression and security retest

- **PASS:** Student login and dashboard remained functional; dashboard continued to show 8 enrolled offerings and 23 units.
- **PASS:** Student Enrollment and Grades are separate browser destinations; Grades displayed Althea's real MATH 101 grade record.
- **PASS:** Faculty login, My Subjects, Class List, Attendance, Gradebook, Student Performance, Dashboard, and Profile remained reachable through the faculty UI.
- **PASS:** Faculty Dashboard values matched the live API/database baseline: 526 assigned subjects and 2,828 related enrollment rows.
- **PASS:** Faculty Profile no longer requests unrestricted `/api/users`.
- **PASS:** Existing student attendance privacy and faculty assigned-offering authorization remain verified by the prior live regression: cross-student/cross-faculty access returned `403`.
- **TEST GAP:** The complete Student A to Faculty/Admin/Registrar route matrix, changed Enrollment/Grade/Academic Record ID matrix, administrator/registrar browser CRUD, filtering, persistence after logout/login, and slow/network-failure states remain intentionally untested. They remain classified as TEST GAP, not failure.

### Updated conclusion

The five audited application failures are fixed and verified through the browser UI without changing the validated dataset. The remaining administrator/registrar CRUD, full security matrix, filtering, persistence, and resilience scenarios remain TEST GAP and must not be represented as PASS until separately executed.
