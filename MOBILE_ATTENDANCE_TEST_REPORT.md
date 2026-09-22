# Faculty Mobile Attendance Tracking System Regression Report

Audit date: 2026-09-21  
Scope: Faculty mobile attendance application and its PIAT backend/database integration.  
Database policy: all mutation tests used `backend/mobile-attendance-regression.db`, a temporary clone of `backend/bwest.db`. The validated databases were not used for mutations.

## Evidence Summary

- Backend syntax passed: `node --check backend/index.js`, `backend/auth/identity.js`, and `backend/db.js`.
- Web build passed: `npm run build`.
- Mobile TypeScript passed after `npm install`: `mobile_build/npx tsc --noEmit`.
- Mobile lint is a TEST GAP because the installed ESLint 8 and `@typescript-eslint` rule versions are incompatible (`allowShortCircuit` error in the existing configuration).
- Expo web export is a TEST GAP because the installed `expo-sqlite` package is missing `web/wa-sqlite/wa-sqlite.wasm`.
- No Android device or emulator was available, so physical offline, restart, and reconnect tests remain TEST GAP.
- Validated database read-only counts: 210 users, 1,122 offerings, 4,803 enrollments, and 2,280 attendance rows.
- Existing validated-data audit: duplicate attendance 0, invalid attendance 0, invalid enrollments 0, and duplicate enrollments 0.
- Validated `backend/bwest.db` SHA-256 after testing: `22184DE572F28DB1BC358BCE672B9D4E1A0004C7AA31CAED4B6FC37EB790C2AC`.
- Validated `backend/data.db` SHA-256 after testing: `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855`.
- Temporary clone and temporary audit script were deleted; both were verified absent.

## Authentication

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-001 | Faculty | Login | JWT issuance | Reviewed login and generated a token in the isolated API test | Faculty receives JWT | `/api/users/login` signs a 7-day JWT containing user ID, role, and optional student ID | PASS | `POST /api/users/login` | Four faculty accounts exist | Mobile sends Bearer token | Device login TEST GAP |
| AUTH-002 | Any | Authentication | Missing, invalid, or forged identity | Sent no Authorization header, invalid JWT, and forged `x-user-*` headers to clone | 401 | All three requests returned 401 | PASS | `GET /api/attendance?subjectOfferingId=...` | Clone only | Header fallback removed from `resolveRequestIdentity`; attendance middleware requires verified JWT | Browser/API evidence only |
| AUTH-003 | Student/Admin/Registrar | Mobile login | Non-faculty account | Reviewed mobile role guard and protected write roles | Faculty-only mobile access | Mobile rejects non-faculty role; live device login not available | TEST GAP | `POST /api/users/login` | Roles exist in validated snapshot | Attendance write route allows admin/faculty only | Device TEST GAP |
| AUTH-004 | Faculty | Session | Logout/re-login/restart | Reviewed SecureStore persistence and dashboard logout | Logout clears session; restart behavior is known | SecureStore and logout exist; restart/re-login not executed on device | TEST GAP | SecureStore and router | No database mutation | No password storage in inspected mobile code | Device TEST GAP |

## Faculty Authorization

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AUTHZ-001 | Faculty A | Assigned subjects | Only token faculty offerings | Requested offerings with JWT and no faculty ID parameter | Only Faculty A offerings | `/api/faculty/offerings` returned 526 offerings for the JWT faculty | PASS | `GET /api/faculty/offerings` | Query joins subjectOfferings to faculty.userId | Client cannot select another faculty by query parameter | API evidence |
| AUTHZ-002 | Faculty A | IDOR | Faculty B offering | Requested another faculty's roster | 403 | Returned 403 | PASS | `GET /api/faculty/subjects/:subjectOfferingId/students` | Clone fixture contains multiple faculty assignments | Ownership uses verified JWT user ID | API evidence |
| AUTHZ-003 | Admin/Registrar | Attendance write | Explicit role policy | Reviewed route middleware | Only explicitly authorized roles write | Admin is currently allowed; registrar is denied. Product policy for admin write access is not documented | TEST GAP | `POST /api/attendance`, `/api/attendance/bulk` | No validated DB mutation | Route role list is explicit | Browser policy test TEST GAP |

## Assigned Subjects

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SUB-001 | Faculty | Assigned subjects | Actual offering metadata | Called authenticated faculty offerings endpoint | Code, name, program, year, semester, academic year, section, offering ID, count | Response returned real subjectOffering rows with all requested metadata and enrolled counts | PASS | `GET /api/faculty/offerings` | Source query uses subjectOfferings, sections, programs, academicYears, semesters, enrollments | Faculty derived from JWT | Device display TEST GAP |

## Student Roster

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ROSTER-001 | Faculty | Class list | Enrolled students only | Called corrected mobile route for own offering | 200 and enrollment-only roster | Returned 200 with 2 enrolled students | PASS | `GET /api/faculty/subjects/:subjectOfferingId/students` | Query joins enrollments to students | Faculty ownership enforced | Device display TEST GAP |
| ROSTER-002 | Faculty | Class list | Obsolete route removed from mobile flow | Compared mobile API route with backend route | No 404 | Mobile now calls `/api/faculty/subjects/:id/students`; the authenticated route returned 200 | PASS | Mobile API and roster route | Existing enrollment records | JWT ownership check | Device TEST GAP |

## Attendance Recording

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ATT-001 | Faculty | Recording | Present/Late/Absent/Excused | Reviewed UI and server status validation | Four valid statuses accepted | UI contains all four; server explicitly accepts only those four | TEST GAP | `POST /api/attendance` | DB CHECK permits four statuses | Invalid status rejected server-side | Full device status test unavailable |
| ATT-002 | Faculty | Recording | Non-enrolled student | Posted non-enrolled student to clone | 403 | Returned 403 `Student is not enrolled in this offering` | PASS | `POST /api/attendance` | Enrollment join checked | Student enrollment is server-side | API evidence |
| ATT-003 | Faculty | Recording | Correct offering reference | Posted `subjectOfferingId` payload | Offering determines faculty/context | Normalized attendance row stored offering ID; academic context is retrieved through reporting joins | PASS | `POST /api/attendance` | FK to subjectOfferings and students | No faculty ID accepted from body | API evidence |

## Offline Storage

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| OFF-001 | Faculty | Offline storage | Save pending attendance | Reviewed existing SQLite queue and save path | Local pending record retained | SQLite attendance table has `pending`, `synced`, and `failed` state behavior; device execution unavailable | TEST GAP | None while offline | Local unique `(studentId, offeringId, date)` | Auth is in SecureStore; local student data is SQLite | Android TEST GAP |
| OFF-002 | Faculty | Offline persistence | App restart | Close/reopen after offline save | Pending row remains | Initialization reads pending/failed queue, but no device restart was executed | TEST GAP | None while offline | Local SQLite queue exists | No plaintext token/password logging observed | Android TEST GAP |

## Synchronization

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SYNC-001 | Faculty | Sync contract | `subjectOfferingId` end to end | Corrected queue payload and ran TypeScript validation | Payload contains offering ID | Sync now sends `record.offeringId` as `subjectOfferingId`; TypeScript passes | PASS | `POST /api/attendance/bulk` | Server column is subjectOfferingId | Mobile sends no legacy identity headers | Physical sync TEST GAP |
| SYNC-002 | Faculty | Automatic sync | Online retry | Reviewed NetInfo listener and queue status handling | Successful records synced; failures retained | NetInfo triggers queue sync; failed records remain failed; device execution unavailable | TEST GAP | Bulk attendance | Queue states are explicit | No deletion before server result in code path | Android TEST GAP |
| SYNC-003 | Faculty | Interrupted sync | Network interruption | Requires 10 pending records and network toggle | Successful records remain synced, failures retry | Not executable without device/network control | TEST GAP | Bulk attendance | No clone mutation for this scenario | No conclusion inferred | Android TEST GAP |

## Duplicate Prevention

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DUP-001 | Faculty | Duplicate attendance | Repeat same student/offering/date | Posted same fixture twice to clone | Same row updated, no duplicate | Both responses returned the same attendance ID; second request updated status to late | PASS | `POST /api/attendance` | Unique student/offering/date key | Server lookup plus DB uniqueness | API evidence |
| DUP-002 | Faculty | Duplicate sync | Repeat bulk retry | Submitted same bulk record after first write | One row only | Bulk returned `updated` and the same attendance ID | PASS | `POST /api/attendance/bulk` | Clone mutation only; no duplicate key created | Stable tuple prevents duplicate retries | API evidence |

## Interrupted Synchronization

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| INT-SYNC-001 | Faculty | Sync interruption | 10 records, disconnect, retry | Requires actual network interruption | No loss and no duplicates | Not executable without Android device/emulator network controls | TEST GAP | `POST /api/attendance/bulk` | No mutation made | No conclusion inferred | Android TEST GAP |

## API Security

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| API-001 | Any | Authentication | Missing/invalid JWT | Sent requests to isolated clone | 401 | Missing and invalid JWT returned 401 | PASS | Attendance GET/POST/bulk | Clone only | `requireJwtRole` is mandatory | API evidence |
| API-002 | Spoofed admin | Authentication | Forged role/user headers | Sent only `x-user-role` and `x-user-id` | 401 | Returned 401 | PASS | Attendance GET | Clone only | Header fallback removed | API evidence |
| API-003 | Faculty | Validation | Invalid status/date | Sent `holiday` and malformed date | 400 | Invalid status returned 400; date validation is explicit | PASS | Attendance POST/bulk | Clone only | Server rejects invalid contract values | API evidence |

## IDOR Testing

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| IDOR-001 | Faculty A | Roster | Faculty B roster | Requested Faculty B offering with Faculty A JWT | 403 | Returned 403 | PASS | Faculty roster endpoint | Clone only | JWT ownership enforced | API evidence |
| IDOR-002 | Faculty A | Attendance | Non-enrolled student | Posted non-enrolled student | 403 | Returned 403 | PASS | Attendance POST/bulk | Clone only | Enrollment membership enforced | API evidence |
| IDOR-003 | Student A | Privacy | Student B attendance | JWT-based live student test | 403 | Source enforces self student ID, but live student account test was unavailable | TEST GAP | `GET /api/attendance` | 203 student accounts in validated snapshot | Student filter uses JWT identity | Browser TEST GAP |

## Student Privacy

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PRIV-001 | Student | Attendance | Own attendance only | Reviewed JWT self-filter and request handling | Student A cannot request Student B | Server compares requested student to JWT student identity; live account test unavailable | TEST GAP | `GET /api/attendance` | Attendance joins normalized student IDs | No client student ID is trusted for student scope | Browser TEST GAP |

## Web Integration

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WEB-001 | Faculty/Student | Web integration | Mobile record in web portals | Requires device-created synchronized record and browser sessions | Same student, subject, section, faculty, date, status, year, semester | Not executable because Android/device sync and browser sessions were unavailable | TEST GAP | Attendance GET and web dashboards | Validated snapshot has normalized attendance | Server uses authoritative attendance table | Browser TEST GAP |
| WEB-002 | Registrar/Admin | Reports | Synchronized record filters | Requires mobile fixture and report UI | Accurate filtering without unauthorized write | Not executable | TEST GAP | Attendance/report routes | Existing read-only audit is clean | Admin write policy requires product confirmation | Browser TEST GAP |

## Error Handling

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ERR-001 | Faculty | Network/API | Offline, timeout, 401, 403, 404, 500 | Reviewed timeout, catch, toast, and sync states; exercised 401/403/404 regression paths | Meaningful state and no silent discard | API 401/403 behavior passes; mobile toast/queue code exists; full network matrix unavailable | TEST GAP | Mobile API and attendance routes | Queue preserves failed records | No token/password logs observed | Android TEST GAP |

## Device Testing

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEVICE-A | Faculty | Online workflow | Login, offering, roster, record, sync | Requires Android device/emulator | Complete online flow | No Android device/emulator available | TEST GAP | Mobile API | Clone API portions pass | JWT path is implemented | Device TEST GAP |
| DEVICE-B | Faculty | Offline workflow | Disable network, record, restart | Requires Android device/emulator | Pending record survives restart | Not executed | TEST GAP | None offline | Local SQLite design retained | Device TEST GAP |
| DEVICE-C | Faculty | Reconnect | Restore network and sync | Requires Android device/emulator | Server receives one record; local becomes synced | Not executed | TEST GAP | Bulk attendance | Clone duplicate API behavior passes | Device TEST GAP |

## Data Integrity

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DATA-001 | System | Validated DB | Existing orphan/duplicate audit | Ran read-only audit | No current orphan/duplicate attendance | Duplicate attendance 0 and invalid attendance 0 | PASS | Read-only SQLite audit | Validated DB unchanged | No mutation | N/A |
| DATA-002 | System | Isolated DB | Mutation isolation | Cloned DB, ran writes, stopped server, deleted clone | Original unchanged | Clone and script absent; original exists with recorded SHA-256 | PASS | Isolated API only | Original hash verified | No validated DB mutation | N/A |

## Regression

| Test ID | Role | Module | Scenario | Steps | Expected | Actual | Result | API Endpoint | Database Evidence | Security Evidence | Device/Browser Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| REG-001 | System | Web | Production build | Ran `npm run build` | Build succeeds | Passed | PASS | N/A | N/A | No unrelated web changes | Build evidence |
| REG-002 | System | Backend | Syntax/startup | Ran Node checks and isolated startup | No syntax/startup errors | Passed; server listened on port 4000 | PASS | N/A | Clone only | Strict JWT routes exercised | Terminal evidence |
| REG-003 | System | Mobile | Type/build validation | Installed dependencies and ran TypeScript; attempted Expo web export | No source diagnostics | TypeScript passed; Expo web export blocked by missing expo-sqlite WASM asset | TEST GAP | N/A | N/A | Lint toolchain incompatibility remains | No device bundle |

## Final Acceptance Answers

1. Faculty authentication works: **TEST GAP** for device login; JWT issuance and enforcement PASS in API/source tests.
2. Faculty sees only assigned offerings: **PASS** at authenticated API level.
3. Correct enrolled students appear: **PASS** at authenticated API level.
4. Present/Late/Absent/Excused work: **TEST GAP** for full device execution; UI and server validation are present.
5. Offline attendance works: **TEST GAP**.
6. Offline records survive restart: **TEST GAP**.
7. Automatic synchronization works: **TEST GAP**; payload contract is fixed and type-checked, but no device reconnect test.
8. Synchronization prevents duplicates: **PASS** for isolated API single and bulk retries; device retry TEST GAP.
9. Faculty accesses only authorized records: **PASS** for isolated API authorization tests.
10. Students see only their own attendance: **TEST GAP** for live student account execution; server self-filter exists.
11. Mobile attendance appears in PIAT web: **TEST GAP**.
12. Registrar/Admin reports are accurate: **TEST GAP**.
13. Unauthorized API requests are rejected: **PASS** for missing, invalid, and forged-header requests.
14. Existing duplicate/orphan records: **PASS** for the validated snapshot.
15. Complete workflow reliability: **TEST GAP** until Android online/offline/restart/reconnect and web integration tests are executed.

## Remaining Re-test Requirements

- Provide an Android emulator/device and execute DEVICE-A through DEVICE-C.
- Fix or align the mobile ESLint dependency versions and provide the missing Expo SQLite WASM asset if web export is required.
- Run synchronized mobile-to-web browser tests using the isolated clone.
- Confirm the explicit product policy for admin attendance writes and registrar reports.
