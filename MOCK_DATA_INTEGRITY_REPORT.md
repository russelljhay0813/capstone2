# Mock Data Integrity Report

- Audit date: 2026-09-21T11:59:15.345Z
- Dataset marker: `[MOCK-DATA:PIAT-SYSTEM-TEST]`
- Scope: marked mock students and their related mock sections/offerings

## Counts

- Students: 200
- Student accounts: 200
- Curriculum records: 223
- Subject offerings: 891
- Enrollments: 4795
- Grades: 3809
- Attendance: 2280
- Academic records: 3726

## Subject Offering Calculation

Expected offerings from actual curriculum-to-section matches: 891.
The expected value is computed as the count of each section's program/year/semester curriculum subjects, across the existing academic-year and semester-linked sections. Duplicate offering groups: 0. Invalid offering-to-curriculum links: 0.

## Integrity Checks

- [PASS] Duplicate subject offerings: 0
- [PASS] Invalid offering curriculum links: 0
- [PASS] Duplicate enrollments: 0
- [PASS] Invalid enrollments: 0
- [PASS] Invalid grades: 0
- [PASS] Grades without enrollment: 0
- [PASS] Duplicate grades: 0
- [PASS] Invalid attendance: 0
- [PASS] Duplicate attendance: 0
- [PASS] Orphan academic records: 0
- [PASS] Unassigned offerings: 0
- [PASS] Offerings without students: 0
- [PASS] Students without subjects: 0

Faculty without mock assignments: 0
Students with no grades: 1
Pending incomplete students without subjects (expected scenario): 9

## Application and UI Findings

## Application and UI Findings

- [PASS] Backend startup: helper imports resolve and the Express API starts on port 4000.
- [PASS] API smoke tests: programs, students, academic structure, offerings, enrollments, grades, attendance, faculty assignments, and faculty class lists returned responses.
- [ISSUE UI-001] Student dashboard subject summary displays 0 offerings / 0 units for a valid approved enrolled student. Direct SQLite shows 8 current enrollments for the tested student, while the frontend requests the default paginated subject-offerings response and does not filter it to the student's current term. This is an application/frontend data-loading issue, not a seed relationship issue.
- [PASS] After clearing stale browser storage and logging in again, the approved mock student reached /dashboard/student.


## Grade Workflow

- draft: 18
- finalized: 3764
- submitted: 27

## Breakdown

| Program | Year level | Semester | Section | Students | Average subjects/student | Enrollments |
|---|---|---|---|---:|---:|---:|
| Diploma in Hospitality Services and Technology | 1st Year | First Semester | A | 3 | 8.00 | 24 |
| Diploma in Hospitality Services and Technology | 1st Year | First Semester | A | 10 | 8.00 | 80 |
| Diploma in Hospitality Services and Technology | 1st Year | First Semester | B | 3 | 8.00 | 24 |
| Diploma in Hospitality Services and Technology | 1st Year | First Semester | B | 10 | 8.00 | 80 |
| Diploma in Hospitality Services and Technology | 1st Year | First Semester | C | 9 | 8.00 | 72 |
| Diploma in Hospitality Services and Technology | 1st Year | First Semester | C | 3 | 8.00 | 24 |
| Diploma in Hospitality Services and Technology | 1st Year | First Semester | r | 1 | 8.00 | 8 |
| Diploma in Hospitality Services and Technology | 1st Year | Second Semester | A | 10 | 8.00 | 80 |
| Diploma in Hospitality Services and Technology | 1st Year | Second Semester | B | 10 | 8.00 | 80 |
| Diploma in Hospitality Services and Technology | 1st Year | Second Semester | C | 9 | 8.00 | 72 |
| Diploma in Hospitality Services and Technology | 2nd Year | First Semester | A | 3 | 7.00 | 21 |
| Diploma in Hospitality Services and Technology | 2nd Year | First Semester | A | 7 | 7.00 | 49 |
| Diploma in Hospitality Services and Technology | 2nd Year | First Semester | B | 7 | 7.00 | 49 |
| Diploma in Hospitality Services and Technology | 2nd Year | First Semester | B | 3 | 7.00 | 21 |
| Diploma in Hospitality Services and Technology | 2nd Year | First Semester | C | 6 | 7.00 | 42 |
| Diploma in Hospitality Services and Technology | 2nd Year | First Semester | C | 3 | 7.00 | 21 |
| Diploma in Hospitality Services and Technology | 2nd Year | Second Semester | A | 7 | 7.00 | 49 |
| Diploma in Hospitality Services and Technology | 2nd Year | Second Semester | B | 7 | 7.00 | 49 |
| Diploma in Hospitality Services and Technology | 2nd Year | Second Semester | C | 6 | 7.00 | 42 |
| Diploma in Hospitality Services and Technology | 3rd Year | First Semester | A | 4 | 6.00 | 24 |
| Diploma in Hospitality Services and Technology | 3rd Year | First Semester | A | 3 | 6.00 | 18 |
| Diploma in Hospitality Services and Technology | 3rd Year | First Semester | B | 4 | 6.00 | 24 |
| Diploma in Hospitality Services and Technology | 3rd Year | First Semester | B | 3 | 6.00 | 18 |
| Diploma in Hospitality Services and Technology | 3rd Year | First Semester | C | 3 | 6.00 | 18 |
| Diploma in Hospitality Services and Technology | 3rd Year | First Semester | C | 3 | 6.00 | 18 |
| Diploma in Hospitality Services and Technology | 3rd Year | Second Semester | A | 4 | 6.00 | 24 |
| Diploma in Hospitality Services and Technology | 3rd Year | Second Semester | B | 3 | 6.00 | 18 |
| Diploma in Hospitality Services and Technology | 3rd Year | Second Semester | C | 3 | 6.00 | 18 |
| Diploma in Hospitality Services and Technology | 4th Year | First Semester | A | 4 | 4.00 | 16 |
| Diploma in Hospitality Services and Technology | 4th Year | First Semester | B | 3 | 4.00 | 12 |
| Diploma in Hospitality Services and Technology | 4th Year | First Semester | C | 3 | 4.00 | 12 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 1st Year | First Semester | A | 9 | 7.00 | 63 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 1st Year | First Semester | A | 3 | 7.00 | 21 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 1st Year | First Semester | B | 4 | 7.00 | 28 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 1st Year | First Semester | B | 9 | 7.00 | 63 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 1st Year | First Semester | C | 3 | 7.00 | 21 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 1st Year | First Semester | C | 10 | 7.00 | 70 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 1st Year | Second Semester | A | 9 | 7.00 | 63 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 1st Year | Second Semester | B | 9 | 7.00 | 63 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 1st Year | Second Semester | C | 10 | 7.00 | 70 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 2nd Year | First Semester | A | 6 | 6.00 | 36 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 2nd Year | First Semester | A | 3 | 6.00 | 18 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 2nd Year | First Semester | B | 3 | 6.00 | 18 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 2nd Year | First Semester | B | 6 | 6.00 | 36 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 2nd Year | First Semester | C | 7 | 6.00 | 42 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 2nd Year | First Semester | C | 3 | 6.00 | 18 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 2nd Year | Second Semester | A | 6 | 6.00 | 36 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 2nd Year | Second Semester | B | 6 | 6.00 | 36 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 2nd Year | Second Semester | C | 7 | 6.00 | 42 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 3rd Year | First Semester | A | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 3rd Year | First Semester | A | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 3rd Year | First Semester | B | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 3rd Year | First Semester | B | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 3rd Year | First Semester | C | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 3rd Year | First Semester | C | 4 | 5.00 | 20 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 3rd Year | Second Semester | A | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 3rd Year | Second Semester | B | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 3rd Year | Second Semester | C | 4 | 5.00 | 20 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 4th Year | First Semester | A | 3 | 4.00 | 12 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 4th Year | First Semester | B | 3 | 4.00 | 12 |
| Diploma in Industrial Education (Major in Hotel and Restaurant Services) | 4th Year | First Semester | C | 4 | 4.00 | 16 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 1st Year | First Semester | A | 9 | 7.00 | 63 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 1st Year | First Semester | A | 4 | 7.00 | 28 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 1st Year | First Semester | B | 3 | 7.00 | 21 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 1st Year | First Semester | B | 9 | 7.00 | 63 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 1st Year | First Semester | C | 3 | 7.00 | 21 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 1st Year | First Semester | C | 10 | 7.00 | 70 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 1st Year | Second Semester | A | 9 | 6.00 | 54 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 1st Year | Second Semester | B | 9 | 6.00 | 54 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 1st Year | Second Semester | C | 10 | 6.00 | 60 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 2nd Year | First Semester | A | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 2nd Year | First Semester | A | 6 | 5.00 | 30 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 2nd Year | First Semester | B | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 2nd Year | First Semester | B | 6 | 5.00 | 30 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 2nd Year | First Semester | C | 6 | 5.00 | 30 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 2nd Year | First Semester | C | 4 | 5.00 | 20 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 2nd Year | Second Semester | A | 6 | 5.00 | 30 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 2nd Year | Second Semester | B | 6 | 5.00 | 30 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 2nd Year | Second Semester | C | 6 | 5.00 | 30 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 3rd Year | First Semester | A | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 3rd Year | First Semester | A | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 3rd Year | First Semester | B | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 3rd Year | First Semester | B | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 3rd Year | First Semester | C | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 3rd Year | First Semester | C | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 3rd Year | Second Semester | A | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 3rd Year | Second Semester | B | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 3rd Year | Second Semester | C | 3 | 5.00 | 15 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 4th Year | First Semester | A | 3 | 4.00 | 12 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 4th Year | First Semester | B | 3 | 4.00 | 12 |
| Diploma in Industrial Education (Major in Multimedia Arts and Design) | 4th Year | First Semester | C | 3 | 4.00 | 12 |
| Diploma in Multimedia Arts and Design | 1st Year | First Semester | A | 3 | 8.00 | 24 |
| Diploma in Multimedia Arts and Design | 1st Year | First Semester | A | 10 | 8.00 | 80 |
| Diploma in Multimedia Arts and Design | 1st Year | First Semester | B | 3 | 8.00 | 24 |
| Diploma in Multimedia Arts and Design | 1st Year | First Semester | B | 10 | 8.00 | 80 |
| Diploma in Multimedia Arts and Design | 1st Year | First Semester | C | 3 | 8.00 | 24 |
| Diploma in Multimedia Arts and Design | 1st Year | First Semester | C | 9 | 8.00 | 72 |
| Diploma in Multimedia Arts and Design | 1st Year | Second Semester | A | 10 | 7.00 | 70 |
| Diploma in Multimedia Arts and Design | 1st Year | Second Semester | B | 10 | 7.00 | 70 |
| Diploma in Multimedia Arts and Design | 1st Year | Second Semester | C | 9 | 7.00 | 63 |
| Diploma in Multimedia Arts and Design | 2nd Year | First Semester | A | 3 | 6.00 | 18 |
| Diploma in Multimedia Arts and Design | 2nd Year | First Semester | A | 7 | 6.00 | 42 |
| Diploma in Multimedia Arts and Design | 2nd Year | First Semester | B | 6 | 6.00 | 36 |
| Diploma in Multimedia Arts and Design | 2nd Year | First Semester | B | 4 | 6.00 | 24 |
| Diploma in Multimedia Arts and Design | 2nd Year | First Semester | C | 3 | 6.00 | 18 |
| Diploma in Multimedia Arts and Design | 2nd Year | First Semester | C | 6 | 6.00 | 36 |
| Diploma in Multimedia Arts and Design | 2nd Year | Second Semester | A | 7 | 6.00 | 42 |
| Diploma in Multimedia Arts and Design | 2nd Year | Second Semester | B | 6 | 6.00 | 36 |
| Diploma in Multimedia Arts and Design | 2nd Year | Second Semester | C | 6 | 6.00 | 36 |
| Diploma in Multimedia Arts and Design | 3rd Year | First Semester | A | 4 | 6.00 | 24 |
| Diploma in Multimedia Arts and Design | 3rd Year | First Semester | A | 3 | 6.00 | 18 |
| Diploma in Multimedia Arts and Design | 3rd Year | First Semester | B | 3 | 6.00 | 18 |
| Diploma in Multimedia Arts and Design | 3rd Year | First Semester | B | 3 | 6.00 | 18 |
| Diploma in Multimedia Arts and Design | 3rd Year | First Semester | C | 3 | 6.00 | 18 |
| Diploma in Multimedia Arts and Design | 3rd Year | First Semester | C | 3 | 6.00 | 18 |
| Diploma in Multimedia Arts and Design | 3rd Year | Second Semester | A | 3 | 5.00 | 15 |
| Diploma in Multimedia Arts and Design | 3rd Year | Second Semester | B | 3 | 5.00 | 15 |
| Diploma in Multimedia Arts and Design | 3rd Year | Second Semester | C | 3 | 5.00 | 15 |
| Diploma in Multimedia Arts and Design | 4th Year | First Semester | A | 3 | 3.00 | 9 |
| Diploma in Multimedia Arts and Design | 4th Year | First Semester | B | 3 | 3.00 | 9 |
| Diploma in Multimedia Arts and Design | 4th Year | First Semester | C | 3 | 3.00 | 9 |
| Diploma in Tourism and Travel Services | 1st Year | First Semester | A | 9 | 7.00 | 63 |
| Diploma in Tourism and Travel Services | 1st Year | First Semester | A | 3 | 7.00 | 21 |
| Diploma in Tourism and Travel Services | 1st Year | First Semester | B | 10 | 7.00 | 70 |
| Diploma in Tourism and Travel Services | 1st Year | First Semester | B | 3 | 7.00 | 21 |
| Diploma in Tourism and Travel Services | 1st Year | First Semester | C | 3 | 7.00 | 21 |
| Diploma in Tourism and Travel Services | 1st Year | First Semester | C | 10 | 7.00 | 70 |
| Diploma in Tourism and Travel Services | 1st Year | Second Semester | A | 9 | 7.00 | 63 |
| Diploma in Tourism and Travel Services | 1st Year | Second Semester | B | 10 | 7.00 | 70 |
| Diploma in Tourism and Travel Services | 1st Year | Second Semester | C | 10 | 7.00 | 70 |
| Diploma in Tourism and Travel Services | 2nd Year | First Semester | A | 6 | 6.00 | 36 |
| Diploma in Tourism and Travel Services | 2nd Year | First Semester | A | 3 | 6.00 | 18 |
| Diploma in Tourism and Travel Services | 2nd Year | First Semester | B | 7 | 6.00 | 42 |
| Diploma in Tourism and Travel Services | 2nd Year | First Semester | B | 3 | 6.00 | 18 |
| Diploma in Tourism and Travel Services | 2nd Year | First Semester | C | 7 | 6.00 | 42 |
| Diploma in Tourism and Travel Services | 2nd Year | First Semester | C | 3 | 6.00 | 18 |
| Diploma in Tourism and Travel Services | 2nd Year | Second Semester | A | 6 | 6.00 | 36 |
| Diploma in Tourism and Travel Services | 2nd Year | Second Semester | B | 7 | 6.00 | 42 |
| Diploma in Tourism and Travel Services | 2nd Year | Second Semester | C | 7 | 6.00 | 42 |
| Diploma in Tourism and Travel Services | 3rd Year | First Semester | A | 3 | 5.00 | 15 |
| Diploma in Tourism and Travel Services | 3rd Year | First Semester | A | 3 | 5.00 | 15 |
| Diploma in Tourism and Travel Services | 3rd Year | First Semester | B | 3 | 5.00 | 15 |
| Diploma in Tourism and Travel Services | 3rd Year | First Semester | B | 4 | 5.00 | 20 |
| Diploma in Tourism and Travel Services | 3rd Year | First Semester | C | 3 | 5.00 | 15 |
| Diploma in Tourism and Travel Services | 3rd Year | First Semester | C | 4 | 5.00 | 20 |
| Diploma in Tourism and Travel Services | 3rd Year | Second Semester | A | 3 | 5.00 | 15 |
| Diploma in Tourism and Travel Services | 3rd Year | Second Semester | B | 4 | 5.00 | 20 |
| Diploma in Tourism and Travel Services | 3rd Year | Second Semester | C | 3 | 5.00 | 15 |
| Diploma in Tourism and Travel Services | 4th Year | First Semester | A | 3 | 3.00 | 9 |
| Diploma in Tourism and Travel Services | 4th Year | First Semester | B | 4 | 3.00 | 12 |
| Diploma in Tourism and Travel Services | 4th Year | First Semester | C | 3 | 3.00 | 9 |

## Faculty Relationship Check

| Faculty | Assigned mock offerings | Enrolled students | Grades | Attendance |
|---|---:|---:|---:|---:|
| Junel Dinglasan | 518 | 190 | 2356 | 760 |
| Justin Gomez | 373 | 190 | 1453 | 1520 |

## Interpretation

A non-zero integrity issue is a seed/data problem and should be fixed in the seed. Pending students without subjects are intentional incomplete-registration edge cases. Backend startup or route failures are application/backend problems. Browser rendering or interaction failures are frontend/UI problems. This report does not hide failures behind dashboard values; all counts come from direct SQLite joins.
