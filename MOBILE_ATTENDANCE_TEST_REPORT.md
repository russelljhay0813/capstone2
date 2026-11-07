# Mobile Attendance Synchronization Audit

**Date:** 2026-11-07  
**Assessment:** **PARTIAL** — backend idempotency and authorization checks pass, but device-level offline/reconnection behavior has not been demonstrated.

## A. Implementation findings

- Faculty login caches assigned offerings, students, and the offering roster in the mobile SQLite database. Attendance is written locally and the local attendance row ID is sent as `localId`.
- The existing natural key `(studentId, offeringId, date)` prevents duplicate local records. The mobile schema now retains the backend attendance ID, retry count, next retry time, last attempt/success time, last error, and retryability. Existing databases receive additive migrations; stale `syncing` rows return to `pending` on startup.
- NetInfo connectivity changes, app startup, foreground resume, and new attendance saved while online trigger synchronization. A backend request is still required; an online network indicator alone does not mark a record synced.
- The sync store serializes uploads, tracks progress, reconciles each response by `localId`, and retains unconfirmed records. Recoverable errors use exponential backoff (30 seconds initially, capped at one hour, eight attempts); validation and authorization errors are not retried automatically.
- The backend validates JWT role, offering ownership, enrollment, date, and status. Faculty identity comes from the authenticated request; a client-supplied faculty ID is not used. SQLite's existing natural-key uniqueness is now used with atomic upserts, returning the existing server ID on retries.
- The app can reopen an existing faculty session and use its cached roster while offline. Attendance date selection is an ISO-date field; status choices remain Present, Late, Absent, and Excused.

## B. Test results

| Test ID | Scenario / procedure | Expected result | Actual result | Status |
|---|---|---|---|---|
| MOB-01 | Record attendance with the device disconnected | Row is saved locally as pending | Local SQLite path is implemented, but no Android runtime was available to execute it | TEST GAP |
| MOB-02 | Navigate away and reopen the attendance screen | Unsynced rows remain available | Not exercised on a device | TEST GAP |
| MOB-03 | Force-stop/restart while offline | Pending and interrupted rows recover | Startup migration resets `syncing` to `pending`; device restart was not exercised | TEST GAP |
| MOB-04 | Upload pending rows and reconcile returned server IDs | Only backend-confirmed rows become synced | Backend API contract tested; mobile-to-SQLite reconciliation not run on a device | TEST GAP |
| MOB-05 | Restore internet / foreground the app | Eligible pending rows sync automatically | NetInfo and foreground triggers implemented; network transition not device-tested | TEST GAP |
| MOB-06 | Repeat and concurrently submit one logical record | One central row and a stable server ID | Three concurrent bulk requests returned the same server ID and one row | PASS |
| MOB-07 | Retry after the backend has already saved a row | Retry returns the existing row | Atomic natural-key upsert and concurrent retry test returned the existing ID | PASS |
| MOB-08 | Close the app during upload | Unconfirmed rows are retryable after restart | Recovery path implemented, but interruption was not simulated on Android | TEST GAP |
| MOB-09 | Timeout, backend unavailable, or HTTP 500 | Keep local data; retry with backoff | Error handling/backoff implemented; fault injection was not run against the mobile app | TEST GAP |
| MOB-10 | Batch contains a valid record and a malformed record | Preserve valid confirmation; isolate failed record | Integration test confirmed valid row and per-record failure in the same response | PASS |
| MOB-11 | Missing/expired authentication | Return 401; retain data and require sign-in | Bulk request without authentication returned 401; expired-token UI flow not device-tested | TEST GAP |
| MOB-12 | Faculty submits for an unassigned offering | Reject with authorization failure | Existing backend test confirms HTTP 403 for another faculty member on the attendance API; bulk reports row-level `Forbidden` for partial-batch handling | PASS |
| MOB-13 | Invalid status/date or malformed record | Reject invalid data without dropping other rows | Invalid single-record status returned 400; malformed bulk row was isolated as failed | PASS |
| MOB-14 | Match local IDs to central attendance IDs | Stable mapping after retry | Bulk response preserved `localId` and returned the same server ID across retries; app-side persistence remains unverified on device | PASS (backend contract) |
| MOB-15 | Compare mobile history to central attendance | Both show the same confirmed records | History reads local sync state and server IDs are reconciled in code; no device/backend end-to-end comparison was possible | TEST GAP |

### Regression and automated checks

- Backend automated suite: **7 passed, 0 failed** (`backend` `npm test`); tests use temporary copies of `backend/piat.db`.
- Backend syntax checks (`node --check`): **PASS**.
- Mobile TypeScript (`npx tsc --noEmit`): **PASS**.
- Android JavaScript bundle (`npx expo export --platform android`): **PASS**. This is a bundle check, not an installed-app or device test.
- Production web build (`npm run build`): **PASS**.
- `git diff --check` on the touched files: **PASS**.
- Mobile ESLint: **TEST GAP** — ESLint failed while loading `@typescript-eslint/no-unused-expressions` (`Cannot read properties of undefined (reading 'allowShortCircuit')`), before reporting source diagnostics.
- No dedicated mobile synchronization test runner exists in `mobile_build/package.json`.

## C. Defects and fixes

| Defect | Root cause | Fix |
|---|---|---|
| Parallel automatic/manual sync could race | Sync action did not guard an in-flight batch | Added a single-flight lock and a queued follow-up pass for rows added during a batch |
| Failed uploads were retried immediately and permanently | No retry timing or permanent-error distinction | Added persisted retry metadata, exponential backoff, an eight-attempt limit, and permanent validation/auth failures |
| A timeout could leave local state ambiguous | Request timeout did not abort the request; server check-then-insert could race | Abort timed-out requests and use atomic backend upserts against the existing unique key |
| Local rows did not retain the server record ID | Local schema had no server ID or sync timestamps | Added backward-compatible local SQLite columns and per-record response reconciliation |
| A retry could display a success-shaped message | UI reported success based on connectivity rather than server confirmation | UI reports local save separately and marks synced only after a matching backend confirmation |
| Reopening offline returned to a network-only login flow | Saved faculty session was not restored from secure storage | Restore the saved faculty session and use the previously cached roster |
| Attendance date could not be selected | Screen always used the current UTC date | Added validated `YYYY-MM-DD` input with local-date default |
| Roster/storage errors could be hidden | Async failures were not surfaced at the attendance screen | Added explicit local-save, roster-load, and synchronization error messages |

Files changed for this task: [mobile SQLite store](./mobile_build/src/lib/db.ts), [sync store](./mobile_build/src/lib/sync-store.ts), [mobile API](./mobile_build/src/lib/api.ts), [attendance screen](./mobile_build/src/screens/attendance.tsx), [dashboard](./mobile_build/src/screens/dashboard.tsx), [history](./mobile_build/app/history.tsx), [login screen](./mobile_build/src/screens/login.tsx), [app layout](./mobile_build/app/_layout.tsx), [backend attendance routes](./backend/index.js), and [backend integration tests](./backend/tests/phase2.test.mjs).

## D. Android verification

**TEST GAP.** Neither `adb` nor the Android emulator command was available. The requested 10-student offline → force-stop → reconnect → resync-once-more scenario was not performed. No device screenshots, Android logs, or on-device API traces were captured. The Expo Android bundle completed successfully, but is not evidence of offline functionality.

## E. Database integrity and safety

- Active database: `backend/piat.db` (`backend/db.js` defaults to this path unless `PIAT_DB_PATH` is set). `backend/data.db` is a zero-byte file and is not the active default.
- Automated backend mutation tests copied the active DB into temporary test directories; they did not use the validated DB as a mutation target.
- SHA-256 before/after test verification: `E5659AEF893071AA86D02FFE8A640849038F4BBE43A219CDA27C70098AF3D417` (unchanged).
- Read-only checks on the active database: `PRAGMA integrity_check` = `ok`; foreign-key violations = **0**; duplicate attendance groups = **0**; orphan attendance rows = **0**.

## F. Final assessment

**PARTIAL.** The app and backend now contain safer offline queueing, retry, reconciliation, and idempotent write behavior, and backend/API/build checks pass. The feature cannot be classified PASS until the required Android offline/restart/reconnection scenario and mobile-to-database verification are run on an emulator or physical device.
