# PIAT School Management System — DFD Level 0

The Level 0 view summarizes only processes found in the backend routes and frontend/mobile clients. Data store labels name the actual central SQLite tables; mobile offline records are separated from central tables.

```mermaid
flowchart LR
  Admin[Administrator]
  Registrar[Registrar]
  Faculty[Faculty]
  Student[Student]
  Mobile[Faculty Mobile Attendance App]

  P1([1. Authentication and User Management])
  P2([2. Student Registration and Profile Management])
  P3([3. Academic Programs and Curriculum Management])
  P4([4. Subject Offerings and Faculty Assignment])
  P5([5. Enrollment and Re-enrollment])
  P6([6. Grade Management and Finalization])
  P7([7. Attendance Recording and Synchronization])
  P8([8. Reports, Dashboards, Announcements and Notifications])

  D1[(D1 Identity and student records<br/>users, students, faculty)]
  D2[(D2 Academic structure<br/>programs, academicYears, semesters, sections, subjects, curriculum)]
  D3[(D3 Offerings and enrollment<br/>subjectOfferings, enrollments)]
  D4[(D4 Grades and academic history<br/>grades, academicRecords)]
  D5[(D5 Attendance<br/>attendance)]
  D6[(D6 Communications and audit<br/>announcements, notifications, activityLogs, settings)]
  D7[(Mobile local cache<br/>faculty, offerings, students, offering_students, attendance)]

  Admin -->|Credentials and account administration| P1
  Registrar -->|Staff/student account administration| P1
  Faculty -->|Credentials| P1
  Student -->|Credentials| P1
  P1 <--> D1

  Student -->|Registration/profile fields| P2
  Registrar -->|Review and status changes| P2
  Admin -->|Student record creation| P2
  P2 <--> D1

  Registrar -->|Programs, curriculum subjects and terms| P3
  Admin -->|Program administration| P3
  P3 <--> D2

  Registrar -->|Offering setup and faculty assignment| P4
  P4 -->|Faculty assignment identity lookup| D1
  P4 <--> D2
  P4 <--> D3

  Registrar -->|Student/offering selection| P5
  Student -->|Enrollment queries| P5
  P5 -->|Student lookup| D1
  P5 -->|Offering and section lookup| D2
  P5 <--> D3
  P5 -->|Re-enrollment notice| D6

  Faculty -->|Grade entries for assigned offerings| P6
  Registrar -->|Finalization request and filters| P6
  Student -->|Own grade query| P6
  P6 -->|Roster and offering context| D3
  P6 -->|Student and faculty identity| D1
  P6 <--> D4
  P6 -->|Grade-posted notification| D6

  Faculty -->|Attendance on web or mobile| P7
  Mobile -->|JWT-authenticated roster request and bulk sync| P7
  Student -->|Own attendance query| P7
  P7 -->|Faculty, student, offering and enrolled-status validation| D1
  P7 -->|Offering and enrollment validation| D3
  P7 <--> D5
  P7 -->|Attendance audit event| D6
  Mobile <--> D7

  Admin -->|Dashboard/report/announcement requests| P8
  Registrar -->|Dashboard/report/announcement requests| P8
  Faculty -->|Dashboard/announcement requests| P8
  Student -->|Dashboard/announcement/notification requests| P8
  P8 -->|Read/report data| D1
  P8 -->|Read/report data| D2
  P8 -->|Read/report data| D3
  P8 -->|Read/report data| D4
  P8 -->|Read/report data| D5
  P8 <--> D6
  P8 -->|Role-scoped dashboards, reports, announcements and notices| Admin
  P8 -->|Role-scoped dashboards, reports, announcements and notices| Registrar
  P8 -->|Role-scoped dashboards and announcements| Faculty
  P8 -->|Personal dashboard, announcements and notices| Student
```

## Authorization and behavior notes

- Backend JWT middleware applies role restrictions to protected endpoints. User-facing role routes exist under `/dashboard/admin`, `/dashboard/registrar`, `/dashboard/faculty`, and `/dashboard/student`.
- Some read routes are public at the API layer, and several UI routes are not a substitute for backend authorization.
- `/api/students/:studentId/reenroll` currently has no authentication middleware. The registrar page/API client uses it, but the handler does not enforce the caller role or a finalized-grade eligibility rule.
- Registration has a frontend/backend mismatch and auto-approval behavior; see the Level 1 flow and validation report.
- D3 enrollment status is verified as `enrolled` for attendance writes. The faculty roster endpoint itself does not filter out dropped/completed enrollment rows.
- `announcements.subjectId` and `notifications.relatedId` are columns without declared foreign keys. They are not drawn as relational links in the ERD.
