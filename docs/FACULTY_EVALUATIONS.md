# Native PIAT faculty evaluations

Faculty evaluations are handled entirely inside PIAT. The React portal uses authenticated Express endpoints and SQLite; no external survey, form, or spreadsheet service is used.

## Administration

Open **Faculty Evaluation** from the admin dashboard to create an evaluation in four steps: enter its title, academic year, semester and dates; edit categories, questions, required flags and rating labels; preview the student questionnaire; then save as draft or publish and activate. New questionnaires start with the six standard categories and 18 questions. Questions can be added, edited, removed and reordered. The 1–5 labels and three optional comment fields are shown to students. Drafts are private and can be edited; publishing requires at least one required question and creates an immutable version. Periods are unique per academic year and semester; closed periods are retained and cannot be changed.

Academic-year and semester choices come from PIAT's academic records. Questionnaire categories and ordered questions are stored with each period. The published version stores a serialized snapshot, rating scale, and question metadata. Existing participation, response, and answer tables remain in use.

## Student workflow

Students see faculty only for subject offerings where they have an active enrollment and a faculty assignment for the evaluation period. Unfinished evaluations appear only while a published period is active and within its configured date range; previously completed evaluations remain visible as Completed. Selecting Evaluate loads that period's published questions and rating labels. Required questions must be answered; optional rating questions may be skipped. Students can also provide the three optional comment fields. Submission eligibility, dates, enrollment, published-version membership, rating validity, completeness, and duplicate prevention are checked by the API and SQLite constraints.

## Faculty reports and privacy

Student completion is stored separately from evaluation answers. The response table has no student or participation reference. Faculty results are scoped to the authenticated faculty account; ordinary faculty endpoints do not expose raw comments or individual answers. Aggregates with fewer than five responses are suppressed. Written comments are stored but are not shown in reports.

## API

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/evaluations/periods` | Admin, registrar, student | List periods (students receive open periods only) |
| `POST /api/evaluations/periods` | Admin | Create a draft period |
| `PUT /api/evaluations/periods/:id` | Admin | Edit a draft, activate it, or close an active period |
| `DELETE /api/evaluations/periods/:id` | Admin | Delete a period only when it is inactive and has no submitted responses or completion history |
| `GET /api/evaluations/questionnaire/default` | Admin | Load the standard categories, questions, and rating scale |
| `GET /api/evaluations/periods/:id/questionnaire` | Admin | Read draft editor data and saved questions |
| `PUT /api/evaluations/periods/:id/questionnaire` | Admin | Save categories, ordered questions, required flags, and rating scale on a draft |
| `GET /api/evaluations/periods/:id/questions` | Admin, eligible student | Read the period's saved or published questions |
| `GET /api/evaluations/eligible` | Student | List the authenticated student's enrolled faculty-subject assignments and completion status |
| `POST /api/evaluations/submit` | Student | Validate and submit one confidential evaluation |
| `GET /api/evaluations/reports` | Admin, registrar | Read suppressed aggregated reports and completion statistics |
| `GET /api/evaluations/my-results` | Faculty | Read aggregates for the authenticated faculty member only |

Academic-year and semester options are read from the existing `GET /api/meta/academic-structure` endpoint.
Deleting an inactive period removes its period-specific questionnaire configuration and published snapshots. Periods with responses or completion records are retained to preserve historical reports; active periods must be closed before deletion.

## Verification

Run the isolated, synthetic-database evaluation tests with:

```bash
node --test backend/tests/faculty-evaluations.test.mjs
```

The tests start temporary SQLite databases and synthetic accounts; they do not modify `database/piat.db`. They cover draft privacy, administrator-only editing, publication and snapshot immutability, student eligibility, required and optional answers, SQLite persistence, aggregated reporting, and the five-response reporting threshold.
