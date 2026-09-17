# Mock Data Test Report

- Test date: 2026-09-17T15:47:10.785Z
- Dataset marker: `[MOCK-DATA:PIAT-SYSTEM-TEST]`
- Password for all mock student accounts: `PiatTest2026!`
- Academic year: 2026-2027
- Semester: First Semester

## Generated Records

| Entity | Count |
|---|---:|
| students | 200 |
| users | 200 |
| sections | 150 |
| subjectOfferings | 891 |
| enrollments | 4795 |
| grades | 3809 |
| attendance | 2280 |
| academicRecords | 3726 |
| notifications | 30 |

Programs tested: Diploma in Hospitality Services and Technology, Diploma in Tourism and Travel Services, Diploma in Multimedia Arts and Design, Diploma in Industrial Education (Major in Hotel and Restaurant Services), Diploma in Industrial Education (Major in Multimedia Arts and Design)
Year levels tested: 1st Year, 2nd Year, 3rd Year, 4th Year
Sections tested: A, B, C
Faculty tested: Maria Santos, Jose Reyes, Ana Bautista, Ramon Garcia where matching existing faculty assignments were available.

## Tests Performed

- [PASS] Exactly 200 mock students generated.
- [PASS] Student IDs remain unique.
- [PASS] Enrollment foreign keys resolve to students and subject offerings.
- [PASS] Curriculum-backed offerings and enrollments exist.
- [PASS] Draft, submitted, and finalized grade scenarios exist.
- [PASS] Attendance statuses are connected to enrolled offerings.
- [PASS] Historical academic records exist for higher-year students.
- [PASS] Grade notifications exist.

## Failed Tests and Issues

- [PASS] Backend starts successfully; API and browser workflow tests are tracked separately from this seed command.

The checks above are direct SQLite validations.
