import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  fetchEligibleFacultyEvaluations,
  fetchEvaluationQuestionsForPeriod,
  fetchFacultyEvaluationPeriods,
  fetchFacultyEvaluationReport,
  fetchMyFacultyEvaluationResults,
  fetchAcademicMetadata,
  createFacultyEvaluationPeriod,
  updateFacultyEvaluationPeriod,
  submitFacultyEvaluation,
  type AcademicMetadata,
  type EligibleFacultyEvaluation,
  type EvaluationPeriodQuestion,
  type FacultyEvaluationPeriod,
  type FacultyEvaluationReport,
  type FacultyEvaluationReportGroup,
} from "@/lib/api";

type PortalRole = "admin" | "registrar" | "student" | "faculty";

const fieldClass = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const ratingLabels = ["Poor", "Fair", "Satisfactory", "Very Satisfactory", "Excellent"];

function EvaluationGroups({ groups }: { groups: FacultyEvaluationReportGroup[] }) {
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
          key={`${group.evaluationId}:${group.subjectOfferingId}`}
          className="rounded-lg border bg-muted/20 p-4"
        >
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <div>
              <h3 className="font-medium">{group.facultyName}</h3>
              <p className="text-sm text-muted-foreground">
                {group.subjectCode} · {group.subjectTitle} ·{" "}
                {group.programName || "Program not listed"} · {group.academicYear} ·{" "}
                {group.semester}
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
              <p key={category.criteriaId} className="rounded bg-background px-3 py-2">
                {category.category}: <strong>{category.average.toFixed(2)}</strong> (
                {category.interpretation})
              </p>
            ))}
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer">Question averages</summary>
            <ul className="mt-2 space-y-1 pl-5">
              {group.questions.map((question) => (
                <li key={question.questionId}>
                  {question.questionText}: <strong>{question.average.toFixed(2)}</strong> (
                  {question.interpretation})
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
  periods,
  values,
  onChange,
}: {
  report: FacultyEvaluationReport;
  periods: FacultyEvaluationPeriod[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const reportablePeriods = periods.filter((period) => period.status !== "draft");
  const offerings = [
    ...new Map(
      report.groups.map((group) => [
        group.subjectOfferingId,
        `${group.subjectCode} · ${group.subjectTitle}`,
      ]),
    ),
  ];
  const options: Array<[string, string, Array<[string, string]>]> = [
    [
      "evaluationId",
      "All evaluation periods",
      reportablePeriods.map((period) => [
        period.id,
        `${period.title} · ${period.academicYear || ""} ${period.semester || ""}`.trim(),
      ]),
    ],
    [
      "facultyId",
      "All faculty",
      [...new Set(report.groups.map((group) => group.facultyId))].map((id) => [
        id,
        report.groups.find((group) => group.facultyId === id)?.facultyName || id,
      ]),
    ],
    ["subjectOfferingId", "All subjects", offerings],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {options.map(([key, label, entries]) => (
        <select
          key={key}
          className={fieldClass}
          aria-label={label}
          value={values[key] || ""}
          onChange={(event) => onChange(key, event.target.value)}
        >
          <option value="">{label}</option>
          {entries.map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}

function assignmentKey(assignment: EligibleFacultyEvaluation): string {
  return `${assignment.evaluationId}:${assignment.subjectOfferingId}`;
}

export function FacultyEvaluationPortal({ role }: { role: PortalRole }) {
  const { user, isHydrated } = useAuth();
  const [periods, setPeriods] = useState<FacultyEvaluationPeriod[]>([]);
  const [academicMetadata, setAcademicMetadata] = useState<AcademicMetadata | null>(null);
  const [report, setReport] = useState<FacultyEvaluationReport | null>(null);
  const [assignments, setAssignments] = useState<EligibleFacultyEvaluation[]>([]);
  const [selectedAssignmentKey, setSelectedAssignmentKey] = useState<string | null>(null);
  const [questions, setQuestions] = useState<EvaluationPeriodQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comments, setComments] = useState({
    facultyStrengths: "",
    areasForImprovement: "",
    additionalComments: "",
  });
  const [periodForm, setPeriodForm] = useState({
    id: null as string | null,
    academicYearId: "",
    semesterId: "",
    startDate: "",
    endDate: "",
  });
  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [periodSaving, setPeriodSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated || user?.role !== role) return;
    let current = true;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        if (role === "admin" || role === "registrar") {
          const [data, metadata] = await Promise.all([
            fetchFacultyEvaluationPeriods(),
            role === "admin" ? fetchAcademicMetadata() : Promise.resolve(null),
          ]);
          if (current) {
            setPeriods(data);
            if (metadata) setAcademicMetadata(metadata);
          }
        } else if (role === "student") {
          const data = await fetchEligibleFacultyEvaluations();
          if (current) setAssignments(data);
        } else {
          const data = await fetchMyFacultyEvaluationResults();
          if (current) setReport(data);
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
    if (!isHydrated || user?.role !== role || (role !== "admin" && role !== "registrar")) return;
    let current = true;
    setReportLoading(true);
    setError(null);
    fetchFacultyEvaluationReport(filters)
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
  }, [filters, isHydrated, role, user?.role]);

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
  const selectedAssignment = assignments.find(
    (assignment) => assignmentKey(assignment) === selectedAssignmentKey,
  );
  const resetPeriodForm = () => {
    setPeriodForm({
      id: null,
      academicYearId: "",
      semesterId: "",
      startDate: "",
      endDate: "",
    });
    setPeriodFormOpen(false);
  };
  const editPeriod = (period: FacultyEvaluationPeriod) => {
    setSuccess(null);
    setError(null);
    setPeriodForm({
      id: period.id,
      academicYearId: period.academicYearId,
      semesterId: period.semesterId,
      startDate: period.startDate,
      endDate: period.endDate,
    });
    setPeriodFormOpen(true);
  };
  const savePeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedYear = academicMetadata?.years.find(
      (year) => year.id === periodForm.academicYearId,
    );
    const selectedSemester = academicMetadata?.semesters.find(
      (semester) => semester.id === periodForm.semesterId,
    );
    if (!selectedYear || !selectedSemester) {
      setError("Choose an academic year and semester from the school records.");
      return;
    }
    setPeriodSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const input = {
        title: `Faculty Evaluation - ${selectedYear.code} - ${selectedSemester.name}`,
        academicYearId: periodForm.academicYearId,
        semesterId: periodForm.semesterId,
        startDate: periodForm.startDate,
        endDate: periodForm.endDate,
      };
      if (periodForm.id) {
        await updateFacultyEvaluationPeriod(periodForm.id, input);
      } else {
        await createFacultyEvaluationPeriod(input);
      }
      setPeriods(await fetchFacultyEvaluationPeriods());
      resetPeriodForm();
      setSuccess(
        periodForm.id ? "Evaluation period updated." : "Evaluation period created as a draft.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save the evaluation period.",
      );
    } finally {
      setPeriodSaving(false);
    }
  };
  const changePeriodStatus = async (
    period: FacultyEvaluationPeriod,
    status: "active" | "closed",
  ) => {
    setError(null);
    setSuccess(null);
    try {
      await updateFacultyEvaluationPeriod(period.id, { status });
      setPeriods(await fetchFacultyEvaluationPeriods());
      setReport(await fetchFacultyEvaluationReport(filters));
      setSuccess(
        status === "active" ? "Evaluation period activated." : "Evaluation period closed.",
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error ? statusError.message : "Unable to update the period status.",
      );
    }
  };
  const startEvaluation = async (assignment: EligibleFacultyEvaluation) => {
    setSelectedAssignmentKey(assignmentKey(assignment));
    setAnswers({});
    setComments({ facultyStrengths: "", areasForImprovement: "", additionalComments: "" });
    setError(null);
    setSuccess(null);
    setQuestionsLoading(true);
    try {
      const data = await fetchEvaluationQuestionsForPeriod(assignment.evaluationId);
      setQuestions(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load evaluation questions.",
      );
      setSelectedAssignmentKey(null);
    } finally {
      setQuestionsLoading(false);
    }
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAssignment) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFacultyEvaluation({
        evaluationId: selectedAssignment.evaluationId,
        subjectOfferingId: selectedAssignment.subjectOfferingId,
        answers: Object.entries(answers).map(([questionId, rating]) => ({ questionId, rating })),
        ...comments,
      });
      setAssignments((current) =>
        current.map((assignment) =>
          assignmentKey(assignment) === assignmentKey(selectedAssignment)
            ? { ...assignment, completed: 1, canSubmit: false }
            : assignment,
        ),
      );
      setSelectedAssignmentKey(null);
      setQuestions([]);
      setSuccess("Your evaluation was submitted successfully. Thank you for your feedback.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to submit the evaluation.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-xl font-bold text-foreground">{title[role]}</h1>
        <p className="text-sm text-muted-foreground">
          {role === "student"
            ? "Rate each faculty member and subject you are enrolled in. Your submitted answers are reported only in aggregated form."
            : "Evaluation responses are summarized in PIAT. Report results are suppressed when fewer than five responses are available."}
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
      {success && (
        <p
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700"
          role="status"
        >
          {success}
        </p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading evaluation information…</p>}

      {(role === "admin" || role === "registrar") && (
        <section className="space-y-5">
          {role === "admin" && (
            <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-heading text-sm font-semibold">Evaluation periods</h2>
                  <p className="text-xs text-muted-foreground">
                    Create one period per academic year and semester. Activating a period opens
                    student submissions.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setError(null);
                    setPeriodForm({
                      id: null,
                      academicYearId: "",
                      semesterId: "",
                      startDate: "",
                      endDate: "",
                    });
                    setPeriodFormOpen(true);
                  }}
                >
                  Create Evaluation Period
                </Button>
              </div>

              {periodFormOpen && (
                <form
                  className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2"
                  onSubmit={savePeriod}
                >
                  <label className="space-y-1 text-sm">
                    <span>Academic Year</span>
                    <select
                      className={fieldClass}
                      required
                      value={periodForm.academicYearId}
                      onChange={(event) =>
                        setPeriodForm((current) => ({
                          ...current,
                          academicYearId: event.target.value,
                          semesterId: "",
                        }))
                      }
                    >
                      <option value="">Select academic year</option>
                      {(academicMetadata?.years || []).map((year) => (
                        <option key={year.id} value={year.id}>
                          {year.code} · {year.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Semester</span>
                    <select
                      className={fieldClass}
                      required
                      value={periodForm.semesterId}
                      onChange={(event) =>
                        setPeriodForm((current) => ({ ...current, semesterId: event.target.value }))
                      }
                    >
                      <option value="">Select semester</option>
                      {(academicMetadata?.semesters || [])
                        .filter(
                          (semester) =>
                            semester.academicYearId === periodForm.academicYearId &&
                            (semester.sequence === 1 || semester.sequence === 2),
                        )
                        .map((semester) => (
                          <option key={semester.id} value={semester.id}>
                            {semester.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Evaluation Start Date</span>
                    <input
                      className={fieldClass}
                      type="date"
                      required
                      value={periodForm.startDate}
                      onChange={(event) =>
                        setPeriodForm((current) => ({ ...current, startDate: event.target.value }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Evaluation End Date</span>
                    <input
                      className={fieldClass}
                      type="date"
                      min={periodForm.startDate || undefined}
                      required
                      value={periodForm.endDate}
                      onChange={(event) =>
                        setPeriodForm((current) => ({ ...current, endDate: event.target.value }))
                      }
                    />
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit" disabled={periodSaving}>
                      {periodSaving ? "Saving…" : periodForm.id ? "Save Changes" : "Create Draft"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={periodSaving}
                      onClick={resetPeriodForm}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {periods.length ? (
                <div className="space-y-2">
                  {periods.map((period) => {
                    const completion = report?.completion.find(
                      (item) => item.evaluationId === period.id,
                    );
                    return (
                      <article
                        key={period.id}
                        className="flex flex-col justify-between gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="font-medium">{period.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {period.academicYear} · {period.semester} · {period.startDate} –{" "}
                            {period.endDate}
                          </p>
                          <p className="text-xs capitalize text-muted-foreground">
                            Status: {period.status}
                            {completion?.suppressed
                              ? " · Completion statistics suppressed"
                              : completion
                                ? ` · ${completion.completedCount}/${completion.eligibleCount} completed (${completion.percentage}%)`
                                : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {period.status === "draft" && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => editPeriod(period)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                onClick={() => void changePeriodStatus(period, "active")}
                              >
                                Activate
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void changePeriodStatus(period, "closed")}
                              >
                                Close
                              </Button>
                            </>
                          )}
                          {period.status === "active" && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void changePeriodStatus(period, "closed")}
                            >
                              Close Period
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No evaluation periods have been created.
                </p>
              )}
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Evaluation periods</p>
              <p className="mt-1 text-xl font-semibold">{periods.length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Reportable evaluation groups</p>
              <p className="mt-1 text-xl font-semibold">{report?.groups.length ?? "—"}</p>
            </div>
          </div>

          {role === "registrar" && (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Registrar access is limited to aggregated evaluation summaries. Individual responses
              and student-identifying information are not available in this portal.
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
              <ReportFilters
                report={report}
                periods={periods}
                values={filters}
                onChange={updateFilter}
              />
              {reportLoading ? (
                <p className="text-sm text-muted-foreground">Loading reports…</p>
              ) : (
                <EvaluationGroups groups={report.groups} />
              )}
            </section>
          )}
        </section>
      )}

      {role === "student" && !loading && (
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-heading text-sm font-semibold">
            Your faculty and subject evaluations
          </h2>
          {assignments.length ? (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <article
                  key={assignmentKey(assignment)}
                  className="flex flex-col justify-between gap-3 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium">{assignment.facultyName}</p>
                    <p className="text-sm text-muted-foreground">
                      {assignment.subjectCode} · {assignment.subjectTitle} ·{" "}
                      {assignment.programName || "Program not listed"} · {assignment.academicYear} ·{" "}
                      {assignment.semester}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {assignment.completed
                        ? "Completed"
                        : assignment.canSubmit
                          ? "Pending"
                          : "Pending · Evaluation period is closed"}
                    </p>
                  </div>
                  {assignment.canSubmit && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void startEvaluation(assignment)}
                    >
                      Evaluate
                    </Button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              There are no faculty evaluations available for your enrollments.
            </p>
          )}

          {selectedAssignment && (
            <form className="space-y-4 border-t pt-4" onSubmit={handleSubmit}>
              <div>
                <h3 className="font-medium">
                  Evaluate {selectedAssignment.facultyName} · {selectedAssignment.subjectCode}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Rate every required question. Your individual answers are confidential.
                </p>
              </div>
              {questionsLoading ? (
                <p className="text-sm text-muted-foreground">Loading evaluation questions…</p>
              ) : (
                <>
                  {questions.length !== 18 ? (
                    <p className="text-sm text-destructive" role="alert">
                      The questionnaire is unavailable because it does not contain all 18 required
                      questions.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        1 Poor · 2 Fair · 3 Satisfactory · 4 Very Satisfactory · 5 Excellent
                      </p>
                      {[...new Set(questions.map((question) => question.category))].map(
                        (category) => (
                          <section key={category} className="space-y-2">
                            <h4 className="font-medium">{category}</h4>
                            {questions
                              .filter((question) => question.category === category)
                              .map((question) => (
                                <fieldset
                                  key={question.questionId}
                                  className="space-y-2 rounded-lg border p-3"
                                >
                                  <legend className="px-1 text-sm font-medium">
                                    {question.questionText} *
                                  </legend>
                                  <div className="flex flex-wrap gap-3">
                                    {ratingLabels.map((label, index) => {
                                      const rating = index + 1;
                                      return (
                                        <label
                                          key={rating}
                                          className="flex items-center gap-1 text-sm"
                                        >
                                          <input
                                            type="radio"
                                            name={question.questionId}
                                            value={rating}
                                            required
                                            checked={answers[question.questionId] === rating}
                                            onChange={() =>
                                              setAnswers((current) => ({
                                                ...current,
                                                [question.questionId]: rating,
                                              }))
                                            }
                                          />
                                          {rating} · {label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </fieldset>
                              ))}
                          </section>
                        ),
                      )}
                      {(
                        [
                          ["facultyStrengths", "Faculty strengths"],
                          ["areasForImprovement", "Areas for improvement"],
                          ["additionalComments", "Additional comments or suggestions"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="block space-y-1 text-sm">
                          <span>{label} (optional)</span>
                          <textarea
                            className={fieldClass}
                            maxLength={2000}
                            rows={3}
                            value={comments[key]}
                            onChange={(event) =>
                              setComments((current) => ({ ...current, [key]: event.target.value }))
                            }
                          />
                        </label>
                      ))}
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={submitting || questions.length !== 18}>
                      {submitting ? "Submitting…" : "Submit evaluation"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => setSelectedAssignmentKey(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}
        </section>
      )}

      {role === "faculty" && (
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Only your own aggregated results are shown. Raw responses and student-identifying
            information are not available in this portal.
          </p>
          <EvaluationGroups groups={report?.groups || []} />
        </section>
      )}
    </div>
  );
}
