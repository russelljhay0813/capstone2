# PIAT Security Audit Report

## A. Executive summary

**Overall assessment: FAIL / PARTIAL.** The nine previously confirmed HIGH-severity defects remain fixed, and the three remaining MEDIUM-severity findings have now been remediated with synthetic-database regression coverage. The audit is not a PASS: the full endpoint inventory, exhaustive IDOR matrix, mobile synchronization authorization, faculty evaluation privacy tests, and some requested checks remain incomplete.

The review examined backend authentication and route authorization in `backend/index.js`, related faculty-evaluation code in `backend/faculty-evaluations.js`, and mobile attendance integration. The new security regression suite uses a newly created temporary SQLite database with synthetic records; it does not copy or open the repository database.

## B. Authentication results

| Requirement | Result | Evidence / limitation |
|---|---|---|
| Password hashing and verification | PARTIAL | Static review found existing scrypt hashing and timing-safe verification. Both login endpoints were not exhaustively exercised. |
| JWT signature and expiry | PARTIAL | Existing JWT verification and expiry handling were reviewed. The new regression suite focuses on inactive-account invalidation rather than every token failure case. |
| Disabled accounts | PASS for tested cases | Active status and role are checked on protected routes, including self-service routes. User and student login reject inactive accounts. Tests verify existing staff/student tokens and subsequent login are rejected after deactivation. |
| Forged identity headers | PARTIAL | Static review found identity derived from verified JWTs. No new request test was run for every forged-header variant. |
| Login rate limiting | PASS for tested cases | Staff and student failed-login attempts use the socket peer address; changing forged `X-Forwarded-For` values did not avoid HTTP 429. No production reverse-proxy trust configuration is present. |
| Logout / refresh persistence | TEST GAP | No browser-session or refresh lifecycle test was run. |

## C. Role permission matrix

| Role | Reviewed boundary | Result |
|---|---|---|
| Administrator | User management, academic management, reports, and authorized grade finalization | PARTIAL; selected account-creation and grade boundaries reviewed, but not every administrative operation was tested. |
| Registrar | Registration/enrollment and academic management; must not grant Administrator access | PASS for the tested Administrator-account creation boundary; otherwise PARTIAL. |
| Faculty | Assigned offerings, enrolled students, grades, attendance, and roster data | PASS for the selected grade/attendance/roster regression cases; otherwise PARTIAL. |
| Student | Own profile and records; no administrative or academic mutation privileges | PARTIAL; selected inactive-account and unrelated-record boundaries reviewed, but a full student-to-student request matrix was not executed. |

## D. Sensitive API inventory

This is a focused inventory of audited sensitive routes, not the complete endpoint-by-endpoint inventory required for final acceptance.

| Method / route | Authentication and roles | Ownership / validation | Result |
|---|---|---|---|
| `POST /api/students/:studentId/reenroll` | Admin or Registrar | Target period remains server-validated; no student self-service | Fixed; missing-token and Faculty requests leave the synthetic database unchanged. |
| `POST /api/users` | Admin or Registrar | Role allowlist; only Admin may create an Admin account | Fixed; Registrar escalation attempt is rejected without creating a user. |
| `GET /api/grades` | Admin, Faculty, Registrar, Student | Faculty results are restricted to assigned offerings; existing student self-access rule retained | Fixed and tested for Faculty-wide and student-filtered queries. |
| `POST /api/grades` | Admin or Faculty | Faculty must own the offering and the student must be actively enrolled; finalized status is reserved for the authorized workflow | Fixed and tested for unassigned enrollment and finalization attempts. |
| `DELETE /api/grades` | Admin or Faculty | Faculty must own the offering | Fixed; cross-offering deletion returns forbidden and preserves the grade. |
| `GET /api/attendance` | Admin, Faculty, Registrar, Student | Faculty results always constrained to assigned offerings; explicit offering requests require ownership | Fixed and tested with synthetic attendance. |
| `GET /api/faculty/subjects/:subjectId/students` | Admin or Faculty | Faculty must own the offering; response contains only ID, student ID, first name, and last name | Fixed and tested for response shape. |
| `PUT /api/students/:studentId` | Admin, Registrar, or the student themself | Student identity comes from the authenticated JWT; self-service allows only validated personal fields. Review/status and academic fields are rejected. | PASS for tested student/Admin/Registrar cases and rejected-request no-mutation checks. |
| `POST /api/students/me/registration` | Authenticated Student | Personal data and application choices are validated; academic choices are stored separately and status is set to pending. | PASS for synthetic application persistence and no enrollment mutation. |
| `GET /api/announcements` | Public or authenticated roles | Backend derives allowed audiences from JWT role; query parameters do not affect filtering. Supported values are `all`, `student`, and `faculty`. | PASS for tested public, Student, Faculty, Registrar, and Admin responses. |
| `/api/notifications` routes | Authenticated roles | Ownership checks reviewed statically; no full mutation matrix run | PARTIAL. |
| Faculty evaluation report routes | See `backend/faculty-evaluations.js` | Privacy and suppression logic reviewed statically; no live Google Workspace access or behavioral report tests | PARTIAL / TEST GAP. |

## E. IDOR testing results

- **Faculty grades:** PASS for tested cases. Faculty A received no grade rows for an unrelated student and could not delete a grade in Faculty B's offering.
- **Faculty attendance:** PASS for tested cases. Faculty A could not retrieve a student-filtered record from Faculty B's offering; an explicit unassigned offering was rejected.
- **Faculty roster:** PASS for tested response fields and assignment ownership.
- **Student-to-student records:** PARTIAL / TEST GAP. The new test suite did not exercise every student profile, enrollment, grade, attendance, notification, and academic-history route in both directions.
- **Registrar-to-Administrator escalation:** PASS for tested user creation request.
- **Missing authentication / wrong role:** PASS for selected reenrollment and protected API paths only.

## F. Input validation and mass assignment

The selected fixes constrain user roles, grade status transitions, and faculty grade writes to enrolled students. Student self-service now uses a personal-information allowlist and rejects registration/review and academic-field changes; the dedicated authenticated registration endpoint stores application choices separately. The broader request-body and field allowlist review was not exhaustive. SQL injection and all date/type/length constraints were not re-tested across every endpoint.

## G. Destructive and privileged operations

The unauthorized re-enrollment and cross-offering grade deletion attempts were tested against the temporary database; both were rejected without changing the related records. Other destructive routes, account changes, academic configuration, announcements, and multi-record transaction behavior were not exhaustively tested.

## H. Mobile attendance security

Static review covered mobile token storage, offline persistence/synchronization, and backend single/bulk attendance authorization. No mobile app or synchronization request was executed. Offline retry after session expiration, reauthentication, and repeated authorization checks remain TEST GAPs.

## I. Notifications, announcements, and faculty evaluation privacy

- Notification ownership checks were reviewed statically; cross-user behavioral coverage is incomplete.
- Announcement audience filtering is enforced server-side for public, Student, Faculty, Registrar, and Admin requests; query-string role/audience tampering is covered by synthetic tests. The schema and application only support `all`, `student`, and `faculty`; no Administrator-only audience category was invented.
- Faculty evaluation access, aggregate suppression, and response fields were reviewed statically. No live spreadsheet or Google service credentials were used, and no behavioral privacy tests were run.

## J. Defects and fixes

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | HIGH | Unauthenticated re-enrollment could create enrollments for an arbitrary student. | Require Admin or Registrar; tested missing-token and wrong-role rejection with no mutation. |
| 2 | HIGH | Registrar could create an Administrator account. | Allowlist roles and restrict Administrator creation to Admin; tested no account is created on rejection. |
| 3 | HIGH | Faculty could delete grades in another Faculty member's offering. | Check offering ownership before deletion; tested rejected deletion and unchanged grade. |
| 4 | HIGH | Faculty grade queries without an offering filter exposed records outside their assignments. | Always scope Faculty queries to assigned offerings; tested broad and student-filtered queries. |
| 5 | HIGH | Faculty could retrieve attendance by student ID without an offering ownership constraint. | Always scope Faculty attendance results to assigned offerings; tested unrelated-student and explicit-offering requests. |
| 6 | HIGH | Inactive accounts could log in or continue using existing tokens. | Check active account status and current role on protected routes, including self-service routes, and reject inactive login; tested staff and student sessions. |
| 7 | HIGH | Faculty could create grades for students not enrolled in the offering. | Require active enrollment before Faculty grade writes; tested rejection and unchanged grade count. |
| 8 | HIGH | Faculty could finalize grades directly or alter an already finalized grade. | Restrict direct grade writes to draft/submitted states and reject edits to finalized grades; finalization remains on the authorized workflow. |
| 9 | HIGH | Faculty roster responses returned every student column. | Return only student ID and name fields needed by the roster; tested exact response keys. |
| 10 | MEDIUM | Student self-service can change registration status and review fields. | Fixed; JWT-derived student identity and explicit personal-field allowlist; rejected status/review/academic mutations preserve synthetic database state. |
| 11 | MEDIUM | Public announcements endpoint returns audience-restricted announcements. | Fixed; backend filters by authenticated role and ignores audience/role query parameters; synthetic role-response tests pass. |
| 12 | MEDIUM | Login rate limiting trusts caller-provided `X-Forwarded-For`. | Fixed; rate-limit identity uses the socket peer address; forged-header attempts still reach HTTP 429 on both login endpoints. |

### Medium-finding remediation details

| Finding | Original vulnerability and root cause | Files changed and fix | Automated tests and actual results | Database mutation verification | Status |
|---|---|---|---|---|---|
| 10 — Student registration status manipulation | `PUT /api/students/:studentId` did not keep student self-service personal updates strictly separate from staff-controlled registration/review fields. | `backend/index.js`, `backend/db.js`, `backend/tests/security-regression.test.mjs`, `src/lib/api.ts`, `src/lib/registrations-store.ts`, `src/routes/register.tsx`. Self-service now uses a personal-information allowlist, validates values, derives the student from the authenticated JWT, enforces route ownership, and rejects protected fields. Academic choices are submitted through `POST /api/students/me/registration` and stored separately in `studentRegistrationApplications`; student submissions remain `pending`. Admin/Registrar management remains on the existing staff route. | Synthetic tests: permitted profile edit returns 200; student attempts to approve/reject, change program/year, spoof student ID, or forge review fields return 403; cross-student profile update returns 403. Admin and Registrar can still manage registration; Admin account management still succeeds. The registration submission returns pending, persists the requested application, and is visible in Registrar list/detail responses. All assertions passed. | For each rejected request, status/review/identity snapshots and the registration-application row remained unchanged. Successful application submission changed only the intended student personal fields and application row; enrollment count remained unchanged. | **PASS** |
| 11 — Public announcement audience exposure | `GET /api/announcements` returned records without an authorization-aware audience predicate, allowing query tampering to request restricted content. The schema and UI support only `all`, `student`, and `faculty`; a read-only query found no existing announcement rows in the repository database. | `backend/index.js`, `backend/tests/security-regression.test.mjs`, `src/lib/announcements-store.ts`. Backend filtering now uses role from an authenticated JWT: public gets `all`; Students get `all`/`student`; Faculty get `all`/`faculty`; Admins and Registrars get the supported shared audiences. Query parameters cannot alter the predicate; create/update validate existing audience values. The client audience type and role visibility helper match the supported set and server policy. | Synthetic tests passed for public, Student, Faculty, Registrar, and Admin responses, including forged `audience`/`role` query values. Student responses excluded Faculty-only content; Faculty responses excluded Student-only content. Attempting to create an unsupported `admin` audience returned 400. No Administrator-only audience category exists, so none was added. | Rejected unsupported-audience creation left the announcement count unchanged. Audience filtering was read-only; synthetic announcements remained unchanged. | **PASS** |
| 12 — Login rate limiting trusts `X-Forwarded-For` | Rate-limit keys used caller-controlled forwarded-IP data, so a client could rotate that header to obtain distinct rate-limit identities. Express does not enable `trust proxy`, and no trusted backend proxy configuration/deployment assumption was found. | `backend/index.js`, `backend/tests/security-regression.test.mjs`. The rate-limit key now uses `req.socket.remoteAddress` (with `req.ip` only as fallback); no unrestricted proxy trust was enabled. | For both `POST /api/users/login` and `POST /api/students/login`, eight failed attempts from the same socket with changing forged `X-Forwarded-For` values were followed by HTTP 429 despite a further header change. Staff and student successful login controls still returned 200. | Login attempts do not mutate student or user records; test assertions cover responses and use only synthetic identities in the temporary database. | **PASS** |

## K. Database safety and validation evidence

- Regression tests set `PIAT_DB_PATH` to a new temporary SQLite database and create only synthetic test accounts and records.
- `PRAGMA integrity_check` returned `ok`; `PRAGMA foreign_key_check` returned no violations.
- The temporary test database was removed by the test cleanup hook.
- The repository database was queried read-only to identify announcement data; it contained no announcement rows. No mutation test used it, and no records were changed. It was already marked modified in the worktree at the beginning of this task; no before/after hash was recorded, so this report does not claim a hash-based integrity comparison.
- The actual deployment database path/configuration was not verified.

## L. Verification summary

| Check | Result |
|---|---|
| Synthetic security regression (includes the nine prior HIGH protections and all three MEDIUM findings) | PASS — 1 top-level test, 0 failures |
| Backend JavaScript syntax | PASS |
| Focused regression-test ESLint | PASS |
| Focused ESLint over related UI modules | FAIL — file-wide Prettier and `no-explicit-any` diagnostics remain in the related source files; no broad formatting/refactor was applied. |
| TypeScript check (`npx tsc --noEmit`) | PASS |
| Production frontend build (`npm run build`) | PASS — Vite production build completed. |
| `git diff --check` | PASS |
| Synthetic SQLite integrity and foreign-key checks | PASS — `integrity_check` was `ok`; `foreign_key_check` returned no rows. |
| Existing `phase2.test.mjs` and full backend suite | TEST GAP — the existing integration suite copies the repository database rather than using a synthetic fixture; it was not run to honor the synthetic-only mutation constraint. |
| Admin-only audience-specific announcement test | TEST GAP / NOT APPLICABLE — the actual table and application support only `all`, `student`, and `faculty`; no Administrator-only value can be exercised without inventing a category. |

## M. Final assessment

The nine selected HIGH defects remain fixed and have targeted regression evidence; all three MEDIUM findings are now fixed and pass the new synthetic regression cases. Overall audit status remains **FAIL / PARTIAL**, not PASS, because the full route inventory, comprehensive cross-role IDOR matrix, mobile synchronization authorization, faculty evaluation privacy behavior, full backend suite, and original database hash comparison were not completed.
