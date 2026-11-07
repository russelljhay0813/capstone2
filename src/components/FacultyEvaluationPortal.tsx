import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  fetchGoogleEvaluationReport,
  fetchGoogleEvaluationStudentAssignments,
  fetchGoogleEvaluationWorkspaceStatus,
  fetchMyGoogleEvaluationResults,
  type GoogleEvaluationGroup,
  type GoogleEvaluationReport,
  type GoogleEvaluationStudentAssignments,
  type GoogleEvaluationWorkspaceStatus,
} from "@/lib/api";

type PortalRole = "admin" | "registrar" | "student" | "faculty";

const fieldClass = "w-full rounded-lg border bg-background px-3 py-2 text-sm";

function ExternalLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild>
      <a href={href} target="_blank" rel="noreferrer">
        {children}
        <ExternalLink className="ml-2 h-4 w-4" />
      </a>
    </Button>
  );
}

function EvaluationGroups({ groups }: { groups: GoogleEvaluationGroup[] }) {
  if (!groups.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No reportable evaluation summaries match these filters.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <article
          key={`${group.facultyName}:${group.subject}:${group.academicYear}:${group.semester}`}
          className="rounded-lg border bg-muted/20 p-4"
        >
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <div>
              <h3 className="font-medium">{group.facultyName}</h3>
              <p className="text-sm text-muted-foreground">
                {group.subject} · {group.programName} · {group.academicYear} · {group.semester}
              </p>
            </div>
            <div className="text-sm sm:text-right">
              <p>{group.responseCount} valid responses</p>
              <p className="font-semibold">
                {group.overallAverage.toFixed(2)} · {group.interpretation}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {group.categories.map((category) => (
              <p key={category.category} className="rounded bg-background px-3 py-2">
                {category.category}: <strong>{category.average.toFixed(2)}</strong> (
                {category.interpretation})
              </p>
            ))}
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer">Question averages</summary>
            <ul className="mt-2 space-y-1 pl-5">
              {group.questionAverages.map((question) => (
                <li key={question.question}>
                  {question.question}: <strong>{question.average.toFixed(2)}</strong>
                </li>
              ))}
            </ul>
          </details>
        </article>
      ))}
    </div>
  );
}

function ReportFilters({
  report,
  values,
  onChange,
}: {
  report: GoogleEvaluationReport;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const options: Array<[string, string, string[]]> = [
    ["academicYear", "All academic years", report.filters.academicYears],
    ["semester", "All semesters", report.filters.semesters],
    ["faculty", "All faculty", report.filters.faculty],
    ["program", "All programs", report.filters.programs],
    ["subject", "All subjects", report.filters.subjects],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {options.map(([key, label, entries]) => (
        <select
          key={key}
          className={fieldClass}
          aria-label={label}
          value={values[key] || ""}
          onChange={(event) => onChange(key, event.target.value)}
        >
          <option value="">{label}</option>
          {entries.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

export function FacultyEvaluationPortal({ role }: { role: PortalRole }) {
  const { user, isHydrated } = useAuth();
  const [workspace, setWorkspace] = useState<GoogleEvaluationWorkspaceStatus | null>(null);
  const [report, setReport] = useState<GoogleEvaluationReport | null>(null);
  const [studentData, setStudentData] = useState<GoogleEvaluationStudentAssignments | null>(null);
  const [facultyGroups, setFacultyGroups] = useState<GoogleEvaluationGroup[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated || user?.role !== role) return;
    let current = true;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        if (role === "admin" || role === "registrar") {
          const status = await fetchGoogleEvaluationWorkspaceStatus();
          if (!current) return;
          setWorkspace(status);
        } else if (role === "student") {
          const data = await fetchGoogleEvaluationStudentAssignments();
          if (current) setStudentData(data);
        } else {
          const data = await fetchMyGoogleEvaluationResults();
          if (current) setFacultyGroups(data.groups);
        }
      } catch (loadError) {
        if (current) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load evaluation data.",
          );
        }
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [isHydrated, role, user?.role]);

  useEffect(() => {
    if (
      !isHydrated ||
      user?.role !== role ||
      (role !== "admin" && role !== "registrar") ||
      !workspace?.sheetsConfigured
    ) {
      return;
    }
    let current = true;
    setReportLoading(true);
    setError(null);
    fetchGoogleEvaluationReport(filters)
      .then((data) => {
        if (current) setReport(data);
      })
      .catch((loadError: unknown) => {
        if (current) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load evaluation reports.",
          );
        }
      })
      .finally(() => {
        if (current) setReportLoading(false);
      });
    return () => {
      current = false;
    };
  }, [filters, isHydrated, role, user?.role, workspace?.sheetsConfigured]);

  if (!isHydrated || user?.role !== role) {
    return <p className="text-sm text-muted-foreground">Authorized {role} access is required.</p>;
  }

  const title: Record<PortalRole, string> = {
    admin: "Faculty Evaluation Management",
    registrar: "Evaluation Monitoring",
    student: "Faculty Evaluation",
    faculty: "My Evaluation Results",
  };
  const updateFilter = (key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-xl font-bold text-foreground">{title[role]}</h1>
        <p className="text-sm text-muted-foreground">
          {role === "student"
            ? "Complete your faculty evaluation in the authorized Google Form. PIAT does not collect your identity with your answers."
            : "Evaluation responses are stored and calculated in Google Sheets. Faculty only see their own aggregated, reportable results."}
        </p>
      </header>

      {error && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading evaluation information…</p>}

      {(role === "admin" || role === "registrar") && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Valid Google Form responses</p>
              <p className="mt-1 text-xl font-semibold">
                {workspace?.totalResponses ?? "Unavailable"}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Individual completion tracking</p>
              <p className="mt-1 text-sm font-medium">Unavailable for anonymous responses</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Evaluation period</p>
              <p className="mt-1 text-sm font-medium">
                {workspace?.period
                  ? `${workspace.period.academicYear} · ${workspace.period.semester} · ${workspace.period.status}`
                  : "Not configured"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {workspace?.formUrl && (
              <ExternalLinkButton href={workspace.formUrl}>Open Google Form</ExternalLinkButton>
            )}
            {workspace?.spreadsheetUrl && (
              <ExternalLinkButton href={workspace.spreadsheetUrl}>
                Open Google Sheets reports
              </ExternalLinkButton>
            )}
          </div>

          {(!workspace?.formConfigured ||
            !workspace?.sheetsConfigured ||
            !workspace?.periodConfigured) && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
              <h2 className="font-semibold">Google Workspace setup is incomplete</h2>
              <p className="mt-1 text-muted-foreground">
                Configure the Form URL, Sheets service account, spreadsheet ID, and verified
                evaluation period in the backend environment. Then follow the PIAT Google Workspace
                setup instructions in the repository documentation.
              </p>
            </div>
          )}

          {role === "registrar" && (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Registrar access is limited to evaluation summaries and links authorized by PIAT. Raw
              response access is controlled by Google Drive sharing.
            </div>
          )}

          {report && (
            <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <div>
                <h2 className="font-heading text-sm font-semibold">Aggregated faculty reports</h2>
                <p className="text-xs text-muted-foreground">
                  Groups with fewer than five responses are suppressed. Written comments and raw
                  answers are not shown here.
                </p>
              </div>
              <ReportFilters report={report} values={filters} onChange={updateFilter} />
              {reportLoading ? (
                <p className="text-sm text-muted-foreground">Loading reports…</p>
              ) : (
                <EvaluationGroups groups={report.groups} />
              )}
            </section>
          )}
        </section>
      )}

      {role === "student" && studentData && (
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div>
            <h2 className="font-heading text-sm font-semibold">Available evaluation period</h2>
            {studentData.period ? (
              <p className="text-sm text-muted-foreground">
                {studentData.period.academicYear} · {studentData.period.semester} ·{" "}
                {studentData.period.startDate} to {studentData.period.endDate} ·{" "}
                {studentData.period.status}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                The Registrar has not configured an evaluation period.
              </p>
            )}
          </div>
          {studentData.assignments.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Your enrolled faculty and subjects</h3>
              {studentData.assignments.map((assignment) => (
                <div
                  key={`${assignment.facultyName}:${assignment.subjectCode}:${assignment.programName || ""}`}
                  className="rounded-lg bg-muted/40 p-3"
                >
                  <p className="font-medium">{assignment.facultyName}</p>
                  <p className="text-sm text-muted-foreground">
                    {assignment.subjectCode} · {assignment.subjectTitle} ·{" "}
                    {assignment.programName || "Program not listed"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No enrolled faculty assignments match the configured evaluation period.
            </p>
          )}
          {studentData.period?.status === "active" && studentData.formUrl && (
            <ExternalLinkButton href={studentData.formUrl}>
              Open anonymous Google Form
            </ExternalLinkButton>
          )}
          {studentData.period?.status === "active" && !studentData.formUrl && (
            <p className="text-sm text-amber-700">
              The evaluation Form link has not been configured.
            </p>
          )}
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              In the Form, select only the faculty member, subject, program, academic year, and
              semester shown above for your enrollment.
            </p>
            <p>
              Do not enter your name, student number, email, or other identifying details in
              comments.
            </p>
            <p>
              Anonymous Forms cannot reliably prevent duplicate submissions or confirm which
              individual students completed them. PIAT therefore does not show individual completion
              status.
            </p>
          </div>
        </section>
      )}

      {role === "faculty" && (
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Only your own aggregated results are shown. Raw responses and student-identifying
            information are not available in this portal.
          </p>
          <EvaluationGroups groups={facultyGroups} />
        </section>
      )}
    </div>
  );
}
