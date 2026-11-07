# PIAT Google Forms and Sheets faculty evaluations

## Setup status

No PIAT Google Form, spreadsheet, OAuth grant, or service-account credential was available to this workspace. The repository now includes a Google Apps Script provisioning template and a backend Google Sheets reader, but live Google resources are **not created or connected** until an authorized PIAT Google Workspace administrator completes the steps below.

The PIAT dashboard is not an evaluation questionnaire. Students submit directly to Google Forms; Google Sheets stores the original responses and calculates reports.

The application no longer creates or reads local questionnaire/response tables. Any legacy evaluation tables or rows already present in an existing PIAT database are left untouched for data-preservation reasons; they are not used by the new workflow.

## 1. Create the Form and spreadsheet

1. Sign in to the PIAT-owned Google account that will own the evaluation Form and spreadsheet.
2. Create a standalone Google Apps Script project and copy `backend/google-workspace/faculty-evaluation-setup.gs` into its editor.
3. In **Project Settings → Script Properties**, add these JSON-array properties using the current, verified PIAT academic records:
   - `PIAT_ACADEMIC_YEARS` — current PIAT academic-year codes.
   - `PIAT_SEMESTERS` — current PIAT semester names/codes.
   - `PIAT_FACULTY` — faculty names from the active faculty roster.
   - `PIAT_SUBJECTS` — subject codes and titles from the current subject catalog.
   - `PIAT_PROGRAMS` — active PIAT program names.

   For example, the format is `["verified value one","verified value two"]`; do not use the example values as PIAT data. Keep these catalog choices synchronized when PIAT academic records change.
4. Run `createPiatFacultyEvaluationWorkspace` as the authorized owner and approve the Google Forms and Sheets permissions. Review the execution log for the respondent Form URL, edit URL, and spreadsheet ID. If Google has not created the Forms response tab yet, set the Form's response destination to the created spreadsheet and rerun `configurePiatFacultyEvaluationReportTabs`.
5. Confirm the Form accepts responses, is not collecting email addresses, does not require sign-in, does not limit users to one response, and does not publish response summaries. The Form has:
   - Section A: Academic Year, Semester, Faculty Member, Subject, and Program.
   - Section B: three required 1–5 scale questions for each of the six PIAT evaluation categories. The question help text defines every scale value.
   - Section C: required strengths and improvement comments, plus optional additional comments.
6. Confirm the spreadsheet contains `Raw Responses`, `Evaluation Summary`, `Faculty Reports`, and `Analytics`. Submit a non-identifying test response in the Form, verify it appears in `Raw Responses`, check the calculated tabs, then delete the test response before opening the evaluation period.

The spreadsheet summary includes average-per-question columns, six category averages, the overall average, and the specified performance interpretation. It uses formulas only; it does not manually enter results. Analytics show response totals, not a completion percentage, because anonymous Forms do not provide a reliable eligible-student denominator.

## 2. Configure Google Sheets API access

1. In a PIAT-controlled Google Cloud project, enable the Google Sheets API and create a service account.
2. Share the spreadsheet with that service-account email as a **Viewer**. Do not share the spreadsheet with faculty or students. Share it directly with only the PIAT administrators and registrars who are authorized to see raw responses.
3. Store the service-account email and private key in the backend deployment's secret/environment manager. Do not put credentials in frontend variables, source control, the Apps Script source, or a public `.env` file.
4. Set the backend environment values in `backend/.env` (or its production secret manager):

   | Variable | Value |
   |---|---|
   | `GOOGLE_EVALUATION_FORM_URL` | Respondent URL printed by the setup script |
   | `GOOGLE_EVALUATION_SPREADSHEET_ID` | Spreadsheet ID printed by the setup script |
   | `GOOGLE_EVALUATION_SERVICE_ACCOUNT_EMAIL` | Service-account email |
   | `GOOGLE_EVALUATION_SERVICE_ACCOUNT_PRIVATE_KEY` | Private key from the service-account JSON; preserve line breaks or encode them as `\n` |
   | `GOOGLE_EVALUATION_ACADEMIC_YEAR` | Exact active academic-year code in PIAT records |
   | `GOOGLE_EVALUATION_SEMESTER` | Exact active semester name or code in PIAT records |
   | `GOOGLE_EVALUATION_START_DATE` | Period start date in `YYYY-MM-DD` |
   | `GOOGLE_EVALUATION_END_DATE` | Period end date in `YYYY-MM-DD` |

5. Restart the backend. The backend exchanges a short-lived signed service-account assertion for an access token and reads only the `Evaluation Summary` tab using the read-only Sheets scope. Tokens and private keys are never sent to the browser. The service-account private key is not stored in PIAT's SQLite database.

## 3. Access and privacy

- The student dashboard lists only faculty/subjects from the student's actual PIAT enrollments for the configured academic year and semester. It links to the shared Google Form; students must select the matching enrollment values there.
- Google Forms is configured not to collect email addresses, require sign-in, or limit one response per user. Do not add name/student-number fields or enable email collection.
- An anonymous Form cannot reliably prevent duplicate submissions or prove that a particular student completed an evaluation. PIAT does not expose per-student completion state or represent response totals as completion rates. If duplicate prevention is required, PIAT must separately design a privacy-reviewed blind-token or aggregate participation process that does not associate a student's identity with their answers.
- Comments can contain self-identifying information even when the Form does not collect identity. Instruct students not to include names, IDs, or other identifying details. Comments and raw answers are not returned by the PIAT dashboard.
- Administrators and authorized registrars can view the linked spreadsheet according to Google Drive sharing. The backend's report APIs are restricted to those roles. Faculty receive only their own PIAT-matched aggregates, and dashboard report groups with fewer than five responses are suppressed. Faculty receive neither raw responses nor the spreadsheet link.
- PIAT Sheets/Forms sharing permissions are enforced by Google Workspace. The PIAT application cannot verify the Google account's Drive permissions from these configuration values; an administrator must audit sharing in Google Drive.

## Dashboard and verification boundaries

The administrator and registrar dashboards provide the Form and spreadsheet links, a response total, academic-year/semester/faculty/program/subject filters, and aggregated report details. The student dashboard shows the configured period and enrollment-matched faculty/subjects. The faculty dashboard calls a server-side, authenticated endpoint that returns only aggregates matching the faculty account.

Before Google Workspace authorization and setup, the dashboard reports the integration as unconfigured. A local build cannot verify that a Google Form opens in PIAT's account, that an actual response lands in the sheet, or that Google Drive sharing is correct. Those checks must be completed by the authorized owner as part of deployment acceptance.
