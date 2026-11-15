# Native PIAT faculty evaluations

Faculty evaluations are handled entirely inside PIAT. The React portal uses authenticated Express endpoints and SQLite; no external survey, form, or spreadsheet service is used.

## Administration

Open **Faculty Evaluation** from the admin dashboard to create a period for an academic year and its First or Second Semester. A period starts as a draft. Admins may edit drafts, activate them to accept submissions, or close them. Periods are unique per academic year and semester; closed periods are retained and cannot be changed.

Academic-year and semester choices come from PIAT's academic records. The database seeds the controlled 18-question questionnaire during initialization and snapshots it when a period is activated.

## Student workflow

Students see faculty members only for subject offerings in which their linked student record is currently enrolled. During an open period, they submit one required 1–5 rating for each of the 18 questions and may provide three optional comment fields. Submission eligibility, dates, enrollment, rating completeness, and duplicate prevention are checked by the API and SQLite constraints.

## Faculty reports and privacy

Student completion is stored separately from evaluation answers. The response table has no student or participation reference. Faculty results are scoped to the authenticated faculty account; ordinary faculty endpoints do not expose raw comments or individual answers. Aggregates with fewer than five responses are suppressed. Written comments are stored but are not shown in reports.

## API

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/evaluations/periods` | Admin, registrar, student | List periods (students receive open periods only) |
| `POST /api/evaluations/periods` | Admin | Create a draft period |
| `PUT /api/evaluations/periods/:id` | Admin | Edit a draft, activate it, or close an active period |
| `GET /api/evaluations/periods/:id/questions` | Admin, student | Read the period's controlled questionnaire |
| `GET /api/evaluations/eligible` | Student | List the authenticated student's enrolled faculty-subject assignments and completion status |
| `POST /api/evaluations/submit` | Student | Validate and submit one confidential evaluation |
| `GET /api/evaluations/reports` | Admin, registrar | Read suppressed aggregated reports and completion statistics |
| `GET /api/evaluations/my-results` | Faculty | Read aggregates for the authenticated faculty member only |

Academic-year and semester options are read from the existing `GET /api/meta/academic-structure` endpoint.

## Verification

Run the isolated, synthetic-database evaluation tests with:

```bash
node --test backend/tests/faculty-evaluations.test.mjs
```

The test starts a temporary SQLite database and test accounts; it does not modify `database/piat.db`.
