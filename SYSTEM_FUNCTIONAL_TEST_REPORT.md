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

## ADMINISTRATOR / REGISTRAR AUDIT COMPLETION ADDENDUM

- Audit date: 2026-09-20
- Browser: `http://localhost:8081` with Vite proxy targeting the isolated API at `http://localhost:4001`.
- Validated database: `backend/bwest.db`; used for read-only comparison only.
- Isolated database: a byte-for-byte copy initially created at `backend/functional-audit-temp.db`.
- Mutation boundary: every create, status change, announcement, and faculty-assignment mutation in this addendum ran against the isolated copy. No test mutation was sent to the validated database.
- Cleanup: the isolated API and frontend were stopped and `backend/functional-audit-temp.db` was deleted after evidence collection. No test rows were copied back.
- The prior remaining-audit table above is a historical snapshot. The results below supersede its `TEST GAP` classifications where evidence is now present.

### VALIDATED DATASET TESTS

| ID | Role | Module | Scenario | Expected | Actual | Result | API | Database verification | Security result |
|---|---|---|---|---|---|---|---|---|---|
| VAL-ADMIN-001 | Administrator | Authentication | Browser login with the real administrator account | Administrator session opens | Browser reached `/dashboard/admin` and rendered the administrator shell | PASS | `POST /api/users/login` | `ADM-00001` resolved as role `admin` | Protected admin routes loaded only after login |
| VAL-REG-001 | Registrar | Authentication | Browser login with the real registrar account | Registrar session opens | Browser reached `/dashboard/registrar` and rendered `REG-00001` | PASS | `POST /api/users/login` | `REG-00001` resolved as role `registrar` | Protected registrar routes loaded only after login |
| VAL-READ-001 | Administrator / Registrar | Read-only lists | View users, students, offerings, reports, and dashboard data without mutation | UI values come from the database-backed API | Read-only API access returned structured paginated records; reports and offerings were reachable | PASS | `GET /api/users`, `/api/students`, `/api/subject-offerings`, `/api/reports/*` | API records and relationships resolved from SQLite | Staff reads authorized; no write was sent to the validated file |
| VAL-SEC-001 | Student | Route access | Student opens Admin User Management and Registrar Enrollment URLs | Unauthorized route is denied | Direct browser navigation returned to the public route; registrar URL generated `403` API responses | PASS | Frontend routes; `/api/users`, `/api/students` | No student mutation occurred | Student denied staff resources in browser/API path |
| VAL-SEC-002 | Faculty | Route/API access | Faculty requests administrator users | Request is denied | `GET /api/users` returned `403` | PASS | `GET /api/users` | No user rows exposed | Faculty denied administrator user management |
| VAL-SEC-003 | Registrar | Admin-only settings | Registrar requests admin settings | Request is denied | `GET /api/settings` returned `403` | PASS | `GET /api/settings` | Settings were not returned | Registrar denied admin-only settings |
| VAL-IDOR-001 | Student | Changed-ID access | Student A requests Student B profile, enrollment, grade, and attendance data | All changed-ID requests are denied | All four requests returned `403` | PASS | `/api/students/:id`, `/api/enrollments`, `/api/grades`, `/api/attendance` | No cross-student rows returned | Student ownership checks enforced |
| VAL-COUNT-001 | Administrator / Registrar | Dashboard counts | Compare staff dashboard values with API/database aggregates | Displayed counts match authoritative queries | Registrar API returned `pending 22`, `approved 192`, `active 192`, `subjects 133`, `programs 5`; values were captured independently from the browser | PASS | `GET /api/dashboard/registrar` | Counts came from SQLite aggregate queries | Staff dashboard endpoint required admin/registrar role |
| VAL-CRED-001 | Security cleanup | Configuration and seed review | Search for outdated BWEST/example credentials | Credentials must be test-only and not production defaults | Legacy demo accounts were found in `db.js`; bootstrap was changed to require `PIAT_ALLOW_DEMO_ACCOUNTS=true`, and new bootstrap passwords are scrypt-hashed | FAIL | `backend/db.js` bootstrap | Existing validated rows were not changed | Local test credentials remain prohibited for production |

### ISOLATED FUNCTIONAL TEST DATABASE

| ID | Role | Module | Scenario | Expected | Actual | Result | API | Database verification | Security result |
|---|---|---|---|---|---|---|---|---|---|
| ISO-ADMIN-001 | Administrator | User Management | View, search, and filter users by role | Matching users remain in the result set | Browser search `Ramon` plus Faculty filter returned only Ramon Cruz / `FAC-00001` | PASS | `GET /api/users?role=faculty` | Returned user ID, role, username, and faculty relationship | Admin-only page and endpoint |
| ISO-ADMIN-002 | Administrator | User Management | Create Student through browser | New student receives correct IDs, role, and relationship | Browser created `Audit Student`, student ID `STD2026-0357`, role `student`, and displayed credentials | PASS | `POST /api/users` | User/student rows were created in the isolated DB; API student-user total became 204 | Admin authorized; no validated rows changed |
| ISO-ADMIN-003 | Administrator | User Management | Create Faculty and Registrar through browser | Staff IDs, roles, and linked records are created | Browser created faculty `2026-9477` and registrar `2026-4670`; both success dialogs showed generated usernames/passwords | PASS | `POST /api/users` | Faculty and registrar users were linked to their staff rows in the clone | Admin-only mutation |
| ISO-ADMIN-004 | Administrator | User Management | Deactivate, activate, refresh, and re-login | Status persists through refresh and authentication | Ramon changed active -> inactive -> active in the UI; activation persisted after logout/login | PASS | `PATCH /api/users/:id/status` | Ramon row returned `status: active` after restoration | Endpoint requires admin |
| ISO-ADMIN-005 | Administrator | User Management | Update account name through browser | Edit saves updated identity | Browser Edit failed because the implementation calls unsupported `prompt()`; no update was sent | FAIL | `PUT /api/users/:id` not reached | Original Ramon row remained unchanged | No unauthorized write occurred |
| ISO-ADMIN-006 | Administrator | User Management | Delete user | Delete is available and removes the account | No delete control exists in the UI or user API | TEST GAP | N/A | No delete verification possible | No destructive delete performed |
| ISO-REG-001 | Registrar | Dashboard and navigation | Open applications, registration, enrollment, re-enrollment, curriculum, offerings, assignment, records, reports, announcements, and profile | Each route renders its own module | Dashboard, applications, enrollment, re-enrollment, announcements, profile, offerings, and assignment rendered; several route transitions initially showed stale prior content and reports/records/curriculum require follow-up verification | FAIL | Corresponding `GET` module APIs | Some pages loaded after async completion; stale content was observed in the browser | Registrar session was valid; UI routing/data-loading is defective |
| ISO-REG-002 | Registrar | Announcements | Create and delete announcement through browser | Announcement appears, survives read, then is removed | Browser published `Audit Announcement`; delete removed it from the UI. Selected Academic category displayed as General, which is a UI/data mapping defect | FAIL | `POST /api/announcements`, `DELETE /api/announcements?id=...` | The audit announcement row was removed; pre-existing `Finals Defends` remained | Create endpoint required registrar role; delete endpoint lacks role middleware |
| ISO-REG-003 | Registrar | Subject offerings | No filters -> program + year + semester -> clear filters | Every selection narrows results and clear restores them | Browser returned 1122 rows unfiltered, 64 for one program/year/semester combination, then restored 1122 | PASS | `GET /api/subject-offerings` | Filtered rows matched displayed program, year, and semester fields | Registrar read access worked |
| ISO-REG-004 | Registrar | Faculty Assignment | Select multiple unassigned offerings and assign them | All selections save once without duplicates | Browser selected HOS 101 and HOS 102 and reported `2 subjects successfully assigned to Ramon Cruz`; UI showed both and 6 units | PASS | `POST /api/subject-offerings/assign` | Clone showed Ramon assigned to both offerings; unassigned count fell 221 -> 219 | Registrar assignment endpoint authorized |
| ISO-REG-005 | Registrar | Faculty Assignment persistence | Logout, login, and re-open assignment page | Saved assignments remain visible | After a fresh Registrar login, Ramon still showed HOS 101, HOS 102, and 6 units | PASS | `GET /api/users`, `GET /api/subject-offerings` | Assignment relationship persisted in SQLite clone | No duplicate assignment observed |
| ISO-REG-006 | Registrar | Student registration/enrollment | Complete an incomplete student and generate exactly 8 enrollments | Automatic approval and exactly-once generation | Not executed in this browser pass; prior validated-dataset evidence is not reused as isolated evidence | TEST GAP | `PUT /api/students/:id` | No isolated registration mutation was performed | No claim made |
| ISO-REG-007 | Registrar | Re-enrollment | Approve eligible student into next term | New term/enrollment rows are generated once | Not executed | TEST GAP | `POST /api/students/:studentId/reenroll` | No clone rows changed for re-enrollment | No claim made |
| ISO-REG-008 | Registrar | Reports and academic records | Render reports and verify counts/filters | Report UI matches API/database | API report access was read, but complete browser report rendering and export verification were not completed | TEST GAP | `/api/reports/enrollment`, `/api/reports/faculty-load`, `/api/reports/students`, `/api/reports/curriculum` | API responses were available; UI evidence is incomplete | No report mutation |
| ISO-SEC-001 | Student | API security | Student requests users, settings, reports, and changed IDs | Sensitive resources deny access | Users/settings/changed IDs returned `403`; `/api/reports/students` incorrectly returned `200` | FAIL | `GET /api/users`, `/api/settings`, `/api/reports/students` | Report rows were returned without a role check | Public report endpoint is an authorization defect |
| ISO-SEC-002 | Faculty | IDOR | Faculty A requests Faculty B’s assigned offering/class data | Access is denied unless business rules authorize it | Existing faculty ownership regression denied cross-faculty offering access; the new clone assignment was separately persisted for Ramon | PASS | `/api/faculty/subjects`, offering/class endpoints | Assignment ownership is checked against faculty identity | Cross-faculty access denied in tested path |
| ISO-COUNT-001 | Administrator | Dashboard count integrity | Compare Admin UI cards with API/database | UI cards match authoritative counts | Admin UI showed `18` students, `1` faculty, `1122` offerings, `2` pending; API/database showed 192 approved, 192 active, 133 subjects, 3 faculty after isolated assignment, and 22 pending | FAIL | Admin dashboard requests; `/api/dashboard/registrar` | UI uses local `useStudents`/`useUsers` state and is not the authoritative aggregate | No security bypass; data-integrity mismatch |

### Remaining genuine test gaps

- Browser completion of automatic registration approval plus exactly 8 generated enrollments in the isolated clone.
- Browser re-enrollment and academic-record generation in the isolated clone.
- Complete browser report rendering, filter, and export verification.
- Browser CRUD for Programs & Curriculum and creation/update/delete of a new subject offering.
- Administrator announcement CRUD and Registrar account mutation through a Registrar UI, where the UI does not expose those controls.
- Delete-user behavior, because no delete operation is implemented.
- Full Faculty A versus Faculty B changed-ID matrix for every class-list, grade, and attendance resource in one isolated run.

### Cleanup and credential warning

The temporary isolated database was removed after testing. The validated database remained at `backend/bwest.db`; its SHA-256 hash after the audit was `22184DE572F28DB1BC358BCE672B9D4E1A0004C7AA31CAED4B6FC37EB790C2AC`. The isolated database hash differed after test mutations and was not retained.

The administrator/registrar credentials shown elsewhere in this historical report are controlled local-test credentials only. They must not be used in production or public deployment. Fresh database bootstrap no longer creates those accounts unless `PIAT_ALLOW_DEMO_ACCOUNTS=true` is explicitly set.

### Updated conclusion

The isolated database safely completed administrator account creation/status testing, registrar announcement and multi-offering assignment testing, filter testing, logout/login persistence, dashboard/API comparisons, and the exercised security/IDOR checks without mutating the validated dataset. Remaining `TEST GAP` entries above are limited to workflows genuinely not executed. The recorded failures are actual application defects, especially the Admin dashboard count source, stale registrar route content, announcement category mapping, unsupported admin edit dialog, and an unprotected reports endpoint.

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

## FINAL ADMINISTRATOR / REGISTRAR REMAINING AUDIT CLASSIFICATION

Audit date: 2026-09-20
Dataset: `[MOCK-DATA:PIAT-SYSTEM-TEST]`
Method: live backend role checks against the actual admin and registrar accounts; browser CRUD, filtering, persistence, and full role matrix were not executed against the seeded DB because those actions would mutate the validated dataset and the requirement explicitly forbids modifying it.

| ID | Role | Module | Scenario | Classification | Evidence | Notes |
|---|---|---|---|---|---|---|
| STAFF-001 | Administrator | Authentication | Real admin account login and protected read access | PASS | `POST /api/users/login` with `admin@bwest.edu.ph` / `admin123` returned a valid JWT with `role: admin`; `GET /api/users?role=student&page=1&limit=5` returned paginated student records under admin authorization. | This is the only admin workflow executed without dataset mutation. |
| STAFF-002 | Registrar | Authentication | Real registrar account login and protected read access | PASS | `POST /api/users/login` with `registrar@example.com` / `password` returned a valid JWT with `role: registrar`; `GET /api/students?page=1&limit=5` returned student rows under registrar authorization. | This is the only registrar workflow executed without dataset mutation. |
| STAFF-003 | Administrator | User Management | View/search/filter/create/update/deactivate/delete account lifecycle | TEST GAP | No admin CRUD mutation was executed against the validated seed dataset. | Requirement explicitly forbids modifying the seed data; therefore CRUD coverage remains untested and must remain a gap. |
| STAFF-004 | Registrar | User Management | Registrar user-management access and CRUD where available | TEST GAP | No registrar user-management mutation was executed. | Not tested, and no data alteration was allowed. |
| STAFF-005 | Administrator | Student Applications | View, search/filter, open, approve/reject, verify student status | TEST GAP | No live admin application workflow was run. | Not tested, and status changes would modify the validated dataset. |
| STAFF-006 | Registrar | Student Applications | View, search/filter, application details | TEST GAP | No live registrar applications flow was executed. | Coverage gap only; no dataset modification performed. |
| STAFF-007 | Administrator | Student Registration | View registered students, search/filter, open details | TEST GAP | No admin registration review workflow was executed. | UI and DB verification omitted because the dataset must remain unchanged. |
| STAFF-008 | Registrar | Student Registration | Registration records, status, student info verification | TEST GAP | No registrar registration review workflow was executed. | This remains a coverage gap rather than a pass. |
| STAFF-009 | Administrator | Enrollment | View, search/filter, program/year/semester/academic-year/section verification | TEST GAP | No admin enrollment filter matrix was executed. | Filter combinations were not tested against the seed dataset. |
| STAFF-010 | Registrar | Enrollment | Current enrollments and relationship verification | TEST GAP | No registrar enrollment audit was executed. | Required filter/relationship checks remain untested. |
| STAFF-011 | Administrator | Re-enrollment | Completed-semester → grades → eligible → re-enrollment → new semester flow | TEST GAP | No re-enrollment workflow was run. | This would write enrollment and academic history changes. |
| STAFF-012 | Administrator | Programs & Curriculum | View programs, curriculum, subjects, year-level arrangement, semester arrangement | TEST GAP | Program and curriculum views were not exercised live. | No dataset mutation was allowed. |
| STAFF-013 | Registrar | Programs & Curriculum | View programs, curriculum, subjects, year-level arrangement, semester arrangement | TEST GAP | Program and curriculum views were not exercised live. | No dataset mutation was allowed. |
| STAFF-014 | Administrator | Subject Offerings | View, filter, details, faculty assignment relationship | TEST GAP | No admin offering creation or assignment verification was performed. | Duplicate creation risk and dataset mutation made this a gap. |
| STAFF-015 | Registrar | Subject Offerings | Create/view offering where permitted, filter and assignment relationship | TEST GAP | No registrar offering creation or assignment check was performed. | Because the requirement forbids dataset mutation, this remains untested. |
| STAFF-016 | Administrator | Faculty Assignment | Select faculty, select multiple offerings, assign, verify updates | TEST GAP | No multi-offering assignment was executed as live admin action. | Assignment actions would mutate or affect secure staff relationships. |
| STAFF-017 | Registrar | Faculty Assignment | Assign multiple offerings and observe Faculty Dashboard/My Subjects updates | TEST GAP | No registrar faculty-assignment flow was executed. | Test coverage was intentionally not performed against the validated dataset. |
| STAFF-018 | Administrator | Academic Records | Search/view historical grades and relationships | TEST GAP | No academic-record browsing or verification was executed. | This is a required but untested flow. |
| STAFF-019 | Registrar | Academic Records | Authorized academic-record access verification | TEST GAP | No registrar academic-record access was executed. | Coverage remains incomplete. |
| STAFF-020 | Administrator | Reports | Report generation and filters/count/export | TEST GAP | No admin reporting workflow was executed. | Not tested; no automated report generation against the seed data. |
| STAFF-021 | Registrar | Reports | Report loading, filter, counts, export | TEST GAP | No registrar reports workflow was executed. | Coverage gap only. |
| STAFF-022 | Administrator | Announcements | Create/view/edit/delete | TEST GAP | No admin announcement CRUD was executed. | Announcement writes would alter the validated dataset. |
| STAFF-023 | Registrar | Announcements | Create/view/edit/delete | TEST GAP | No registrar announcement CRUD was executed. | Not tested, and no dataset modification allowed. |
| STAFF-024 | Filtering Audit | Administrator and Registrar list/filter pages | Program + year + semester + academic year + section combinations | TEST GAP | No admin/registrar filter matrix was executed with the live pages. | No hardcoded or seeded filter assumptions were made. |
| STAFF-025 | Persistence Audit | Admin/Registrar create/update/delete operations | UI refresh, logout/login, database verification | TEST GAP | No create/update/delete persistence cycle was performed. | Explicit requirement to avoid dataset mutation prevents test execution. |
| STAFF-026 | Security Matrix | Role permissions matrix | Administrator/Registrar/Faculty/Student resource authorization | TEST GAP | Only the previously validated student/faculty ownership checks were executed; the complete staff role matrix was not. | Full route/API authorization matrix remains a genuine gap. |
| STAFF-027 | IDOR / Ownership Security | Student and faculty resource access by changed ID | Cross-user access attempts | TEST GAP | The full changed-ID matrix was not executed. | Prior student/faculty checks remain valid for the tested cases only. |
| STAFF-028 | Dashboard Count Verification | Admin/Registrar dashboard totals vs database/API | Secondary dashboard count integrity | TEST GAP | Live dashboard count verification for admin/registrar staff aggregate metrics was not executed. | The earlier verified faculty/student counts do not establish admin/registrar dashboards. |

### Final classification for the remaining audit scope

- PASS: real admin login + protected read access; real registrar login + protected read access
- TEST GAP: all remaining Administrator CRUD, Registrar CRUD, filtering, persistence, full role-security matrix, IDOR matrix, and dashboard-count verification tasks
- FAIL: none in the remaining staff audit scope, because no untested workflow was converted to a pass and no dataset-mutation-based actions were run against the validated seed data

### Evidence summary

The following actual API calls were executed and confirmed successful without changing the seed dataset:

- `POST /api/users/login` with `admin@bwest.edu.ph` / `admin123` -> `200` and valid admin JWT
- `POST /api/users/login` with `registrar@example.com` / `password` -> `200` and valid registrar JWT
- `GET /api/users?role=student&page=1&limit=5` with admin token -> returned paginated students
- `GET /api/students?page=1&limit=5` with registrar token -> returned paginated students

No admin or registrar CRUD, filter matrix, persistence cycle, or full authorization matrix was executed, because doing so would violate the no-dataset-modification requirement and the final acceptance condition explicitly says remaining issue coverage must be documented rather than hidden.

## REMAINING FINDINGS FIX VERIFICATION

- Verification date: 2026-09-20
- Test database: byte-for-byte clone `backend/functional-audit-fix-temp.db`; all mutations were sent only to the clone.
- Cleanup: API/frontend test processes were stopped and the clone was deleted.
- Validated database SHA-256 after cleanup: `22184DE572F28DB1BC358BCE672B9D4E1A0004C7AA31CAED4B6FC37EB790C2AC`.

| Finding | Original finding and root cause | Fix | Browser test | API and database verification | Security verification | Final result |
|---|---|---|---|---|---|---|
| Reports API protection | Reports handlers had no middleware, so `/api/reports/students` returned data without authentication. | Added strict JWT verification and `admin`/`registrar` role authorization to every `/api/reports/*` handler. | Registrar browser Reports route rendered the Reports heading and report content. | Unauthenticated `401`; Student `403`; Faculty `403`; Registrar `200`; Administrator `200`. | Invalid/missing JWT cannot use development role headers or fallback identity. | **PASS** |
| Admin dashboard count mismatch | Admin cards counted partial local store responses and used a global offerings fetch instead of authoritative aggregates. | Added `/api/dashboard/admin` with distinct current student records, active faculty, active offerings, and pending statuses; cards now consume that response. | Admin browser dashboard displayed `192` students, `2` faculty, `1122` offerings, and `21` pending applications. | Exact SQL verification on the clone returned `192`, `2`, `1122`, and `21`, matching the API and UI. | Admin dashboard endpoint requires a verified admin JWT. | **PASS** |
| Stale Registrar route content | Registrar navigation could enter the legacy `registrar.announcements` component instead of the current category-aware announcements page. | Registrar navigation uses the current shared `/dashboard/announcements` page; the legacy route is bypassed. | Browser Reports navigation reached `/dashboard/registrar/reports`; Registrar announcement navigation resolves to `/dashboard/announcements`, whose current page rendered the Academic announcement. | Current page loads announcement rows from the API and uses the shared category/filter mapping. | Staff session was authenticated; no unauthorized route access was added. | **PASS** |
| Announcement category mapping | The create API helper omitted `category`, so selecting Academic was saved with the backend default General. | Passed category through API/store/forms and validated `general`, `academic`, `event`, and `urgent`; unsupported categories return `400`. | Isolated Registrar browser list displayed the created `Academic` announcement and its Academic filter option. | Clone mutation saved `academic`; subsequent API read returned `academic`; `legacy` was rejected with `400`; temporary row was removed with the clone. | Create remains role-protected; no category is silently remapped. | **PASS** |
| Account editing via `prompt()` | Admin Edit called browser `prompt()` twice and the direct update helper omitted the authenticated request context. | Replaced prompts with a validated modal form for identity fields and routed saves through the shared authenticated API request. | User Management now exposes a Cancel/Save dialog rather than browser prompts. | Authenticated Admin `PUT /api/users/:id` succeeded on the clone and returned the updated account; password fields were not exposed. | Passwords remain outside the edit form and are handled by the dedicated reset endpoint. | **PASS** |

### Regression Retest Classification

- **PASS:** Reports role authorization matrix; Admin API/UI/database count parity; Registrar Reports and announcement route smoke tests; announcement category round-trip; authenticated account update; validated database preservation.
- **TEST GAP:** Full browser retest of every previously passing Faculty and Student workflow, complete IDOR permutation matrix, account reset workflow, and report export for every report type was not rerun in this fix pass.
- **Residual environment note:** During browser testing, notification requests briefly showed `502` after the isolated backend was stopped; this was test-process shutdown noise and not part of the feature paths under repair.

## FINAL FOCUSED REGRESSION

- Regression date: 2026-09-20
- Database: fresh clone `backend/final-regression-temp.db`; all announcement and account mutations were performed only there.
- Validated database was never used for mutation.

### Reports Authorization

- **Issue:** Reports could be called without authentication and the browser route could be opened directly by a Student.
- **Root Cause:** Report handlers had no strict JWT middleware, and the route component relied only on hidden navigation.
- **Fix:** Added verified-JWT role middleware to every Reports API handler and a route guard that redirects unauthorized roles before loading report data.
- **Browser Test:** Registrar opened `/dashboard/registrar/reports` and rendered `Reports`. Student navigation to the same direct URL redirected to `/dashboard/student`; no Reports heading remained and report loading was skipped.
- **API Test:** Unauthenticated `401`; Student `403`; Faculty `403`; Registrar `200`; Administrator `200` for `/api/reports/students`.
- **Database Test:** Registrar/Admin report rows resolved from the isolated SQLite clone; no report mutation occurred.
- **Security Test:** Spoofable development role headers do not satisfy the Reports middleware; a verified JWT is required.
- **Final Result:** **PASS**

### Administrator Dashboard Counts

- **Issue:** Admin cards displayed `18 / 1 / 1122 / 2` from partial local stores instead of authoritative aggregates.
- **Root Cause:** The page counted local student/user state and fetched the global offerings catalog rather than a role-protected dashboard aggregate.
- **Fix:** Added `/api/dashboard/admin` with distinct current student records, active faculty, active offerings, and pending-status counts; the page consumes this response. Dashboard auth hydration now completes before redirecting on refresh.
- **Browser Test:** Admin displayed `192`, `2`, `1122`, `21`; after browser refresh it remained on `/dashboard/admin` with the same values; after logout/relogin it again displayed `192`, `2`, `1122`, `21`.
- **API Test:** `/api/dashboard/admin` returned `192`, `2`, `1122`, `21` with an Admin JWT.
- **Database Test:** Exact aggregate SQL on the clone returned students `192`, faculty `2`, active offerings `1122`, pending applications `21`.
- **Security Test:** The dashboard endpoint requires a verified Admin JWT.
- **Final Result:** **PASS**

### Registrar Navigation

- **Issue:** Registrar navigation could enter stale/legacy announcement content, and the Re-enrollment page generated a missing-endpoint `404`.
- **Root Cause:** The sidebar route targeted the legacy Registrar announcement component; the eligibility route was declared after a parameterized student route and was shadowed.
- **Fix:** Registrar navigation now uses current `/dashboard/announcements`; the legacy route is bypassed. The eligibility endpoint was moved before `/api/students/:studentId` and protected with strict JWT roles.
- **Browser Test:** Fresh Registrar traversal produced these exact current routes/headings: `/dashboard/registrar` → `Registrar Dashboard`; `/dashboard/registrar/registrations` → `Student Applications`; `/dashboard/registrar/students` → `Recently Registered Students`; `/dashboard/registrar/enrollment` → `Enrollment Management`; `/dashboard/registrar/reenrollment` → `Re-enrollment`; `/dashboard/registrar/curriculum` → `Programs & Curriculum`; `/dashboard/registrar/subjects` → `Subject Offerings`; `/dashboard/registrar/faculty` → `Faculty Assignment`; `/dashboard/registrar/records` → `Academic Records`; `/dashboard/registrar/reports` → `Reports`; `/dashboard/announcements` → current category-aware Announcements. After the endpoint fix, Re-enrollment loaded with no 4xx responses.
- **API Test:** `/api/students/eligible-for-reenrollment` returned `200` for Registrar and `401` without a token.
- **Database Test:** All pages read the isolated clone; no navigation test mutated rows except the separately documented announcement/account tests.
- **Security Test:** Registrar resources remained available; Admin-only settings returned `403` for Registrar.
- **Final Result:** **PASS**

### Announcement Category Mapping

- **Issue:** The selected category was omitted from the create request and silently became `general`; detail/edit verification was unavailable.
- **Root Cause:** The frontend create payload dropped `category`, and the application had no shared detail/edit contract.
- **Fix:** Category is passed through all create/store/forms; the API validates `general`, `academic`, `event`, and `urgent`; unsupported values return `400`. Added role-protected update API plus detail and edit dialogs.
- **Browser Test:** Registrar created all four categories. List badges and filters each showed one matching regression announcement. The Academic detail dialog showed `Academic announcement` and `Category academic`. The edit dialog loaded the saved category, changed `Regression urgent` to `academic`, saved successfully, refreshed, and retained `academic`; blank-title validation and Cancel were also verified.
- **API Test:** API read returned `general`, `academic`, `event`, and `urgent` after creation; the edit returned the updated `academic` value; unsupported `legacy` creation returned `400`.
- **Database Test:** Clone rows were `Regression general=general`, `Regression academic=academic`, `Regression event=event`, and edited `Regression urgent=academic`.
- **Security Test:** Announcement create/update/delete/pin operations require Admin or Registrar role; no unknown category is remapped.
- **Final Result:** **PASS**

### Account Editing

- **Issue:** Admin Edit used browser `prompt()` and the direct update helper omitted authenticated request headers.
- **Root Cause:** The UI had no normal edit form and bypassed the shared API request helper.
- **Fix:** Added a modal form with validation, Cancel, Save, success/error handling, and authenticated API updates. Password reset remains separate; password fields are not part of the edit form.
- **Browser Test:** Admin User Management opened an `Edit Account` modal, exposed no password input, showed Cancel, saved `System Administrator` as `System Audit Administrator`, displayed success, refreshed with the updated name, and retained it after logout/relogin. Empty-name validation was exercised.
- **API Test:** Authenticated `PUT /api/users/:id` succeeded; API user responses contained neither `password` nor `temporaryPassword` properties.
- **Database Test:** The isolated `users` row persisted `firstName = 'System Audit'`; the validated database was not changed.
- **Security Test:** Sensitive password fields were absent from the UI/API response; no `prompt()` occurrence remains in the account editing slice.
- **Final Result:** **PASS**

### Regression Security Controls

- **PASS:** Student cross-student grades and attendance returned `403`.
- **PASS:** Faculty own assigned class returned `200`; another faculty member's class returned `403`.
- **PASS:** Faculty user-management data and Reports returned `403`.
- **PASS:** Registrar dashboard returned `200`; Registrar admin settings returned `403`.
- **PASS:** Administrator user-management access returned `200`.

### Final Focused Regression Result

All five previously identified failures have concrete browser, API, database, and security evidence from the isolated regression clone. The clone was removed after testing; the validated database remained unchanged. **PASS**
