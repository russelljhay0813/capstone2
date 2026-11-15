import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  fetchEligibleFacultyEvaluations,
  fetchEvaluationQuestionsForPeriod,
  fetchDefaultFacultyEvaluationQuestionnaire,
  fetchFacultyEvaluationQuestionnaire,
  fetchFacultyEvaluationPeriods,
  fetchFacultyEvaluationReport,
  fetchMyFacultyEvaluationResults,
  fetchAcademicMetadata,
  createFacultyEvaluationPeriod,
  saveFacultyEvaluationQuestionnaire,
  updateFacultyEvaluationPeriod,
  submitFacultyEvaluation,
  type AcademicMetadata,
  type EligibleFacultyEvaluation,
  type EvaluationPeriodQuestion,
  type EvaluationQuestionnaireCategory,
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
    title: "",
    academicYearId: "",
    semesterId: "",
    startDate: "",
    endDate: "",
  });
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3 | 4>(1);
  const [builderCategories, setBuilderCategories] = useState<EvaluationQuestionnaireCategory[]>([]);
  const [ratingScale, setRatingScale] = useState(
    ratingLabels.map((label, index) => ({
      value: index + 1,
      label,
    })),
  );
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
    if (role === "student") {
      setAssignments([]);
      setSelectedAssignmentKey(null);
      setQuestions([]);
    }
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
  }, [isHydrated, role, user?.id, user?.role, user?.studentId, user?.token]);

  useEffect(() => {
    if (!isHydrated || role !== "student" || user?.role !== "student") return;
    let current = true;
    const refresh = async () => {
      try {
        const data = await fetchEligibleFacultyEvaluations();
        if (current) setAssignments(data);
      } catch (loadError) {
        if (current) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to refresh evaluation data.",
          );
        }
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const refreshInterval = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      current = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isHydrated, role, user?.id, user?.role, user?.studentId, user?.token]);

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
  const questionnaireCanSubmit =
    questions.length > 0 && questions.some((question) => question.isRequired);
  const resetPeriodForm = () => {
    setPeriodForm({
      id: null,
      title: "",
      academicYearId: "",
      semesterId: "",
      startDate: "",
      endDate: "",
    });
    setBuilderStep(1);
    setBuilderCategories([]);
    setPeriodFormOpen(false);
  };
  const openNewBuilder = async () => {
    setSuccess(null);
    setError(null);
    setPeriodForm({
      id: null,
      title: "",
      academicYearId: "",
      semesterId: "",
      startDate: "",
      endDate: "",
    });
    setBuilderStep(1);
    setPeriodFormOpen(true);
    setPeriodSaving(true);
    try {
      const defaults = await fetchDefaultFacultyEvaluationQuestionnaire();
      setBuilderCategories(defaults.categories);
      setRatingScale(defaults.ratingScale);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the default questionnaire.",
      );
      setPeriodFormOpen(false);
    } finally {
      setPeriodSaving(false);
    }
  };
  const editPeriod = async (period: FacultyEvaluationPeriod) => {
    setSuccess(null);
    setError(null);
    setPeriodForm({
      id: period.id,
      title: period.title,
      academicYearId: period.academicYearId,
      semesterId: period.semesterId,
      startDate: period.startDate,
      endDate: period.endDate,
    });
    setPeriodFormOpen(true);
    setBuilderStep(1);
    setPeriodSaving(true);
    try {
      const questionnaire = await fetchFacultyEvaluationQuestionnaire(period.id);
      setBuilderCategories(questionnaire.categories);
      setRatingScale(questionnaire.ratingScale);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load the draft questionnaire.",
      );
    } finally {
      setPeriodSaving(false);
    }
  };
  const savePeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (builderStep !== 1) return;
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
    if (!periodForm.title.trim()) {
      setError("Enter an evaluation title.");
      return;
    }
    setBuilderStep(2);
  };
  const saveQuestionnaire = async (publish: boolean) => {
    const selectedYear = academicMetadata?.years.find(
      (year) => year.id === periodForm.academicYearId,
    );
    const selectedSemester = academicMetadata?.semesters.find(
      (semester) => semester.id === periodForm.semesterId,
    );
    if (!selectedYear || !selectedSemester) {
      setError("Choose an academic year and semester from the school records.");
      setBuilderStep(1);
      return;
    }
    if (
      publish &&
      !builderCategories.some((category) =>
        category.questions.some((question) => question.isRequired && question.questionText.trim()),
      )
    ) {
      setError("Add at least one required question before publishing.");
      return;
    }
    setPeriodSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const input = {
        title: periodForm.title.trim(),
        academicYearId: periodForm.academicYearId,
        semesterId: periodForm.semesterId,
        startDate: periodForm.startDate,
        endDate: periodForm.endDate,
      };
      let evaluationId = periodForm.id;
      if (evaluationId) {
        await updateFacultyEvaluationPeriod(evaluationId, input);
      } else {
        const period = await createFacultyEvaluationPeriod(input);
        evaluationId = period.id;
        setPeriodForm((current) => ({ ...current, id: period.id }));
      }
      await saveFacultyEvaluationQuestionnaire(evaluationId, {
        categories: builderCategories,
        ratingScale,
      });
      if (publish) {
        await updateFacultyEvaluationPeriod(evaluationId, { status: "active" });
      }
      setPeriods(await fetchFacultyEvaluationPeriods());
      if (publish) setReport(await fetchFacultyEvaluationReport(filters));
      resetPeriodForm();
      setSuccess(publish ? "Evaluation published and activated." : "Evaluation saved as a draft.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the evaluation questionnaire.",
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
      const data = await fetchEvaluationQuestionsForPeriod(
        assignment.evaluationId,
        assignment.subjectOfferingId,
      );
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
      setSelectedAssignmentKey(null);
      setQuestions([]);
      setSuccess("Your evaluation was submitted successfully. Thank you for your feedback.");
      try {
        setAssignments(await fetchEligibleFacultyEvaluations());
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `Evaluation submitted, but the list could not be refreshed: ${refreshError.message}`
            : "Evaluation submitted, but the list could not be refreshed.",
        );
      }
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
                <Button type="button" onClick={() => void openNewBuilder()}>
                  Create Evaluation Questionnaire
                </Button>
              </div>

              {periodFormOpen && (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div>
                    <p className="text-sm font-semibold">
                      Step {builderStep} of 4 ·{" "}
                      {
                        [
                          "Evaluation Details",
                          "Evaluation Questions",
                          "Preview",
                          "Save and Publish",
                        ][builderStep - 1]
                      }
                    </p>
                    <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden="true">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`h-1 rounded ${step <= builderStep ? "bg-primary" : "bg-border"}`}
                        />
                      ))}
                    </div>
                  </div>

                  {builderStep === 1 && (
                    <form className="grid gap-3 sm:grid-cols-2" onSubmit={savePeriod}>
                      <label className="space-y-1 text-sm sm:col-span-2">
                        <span>Evaluation title</span>
                        <input
                          className={fieldClass}
                          required
                          maxLength={200}
                          value={periodForm.title}
                          onChange={(event) =>
                            setPeriodForm((current) => ({ ...current, title: event.target.value }))
                          }
                        />
                      </label>
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
                            setPeriodForm((current) => ({
                              ...current,
                              semesterId: event.target.value,
                            }))
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
                            setPeriodForm((current) => ({
                              ...current,
                              startDate: event.target.value,
                            }))
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
                            setPeriodForm((current) => ({
                              ...current,
                              endDate: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="flex gap-2 sm:col-span-2">
                        <Button type="submit">Continue to questions</Button>
                        <Button type="button" variant="outline" onClick={resetPeriodForm}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}

                  {builderStep === 2 && (
                    <div className="space-y-4">
                      <section className="space-y-3">
                        <h3 className="text-sm font-semibold">Rating scale</h3>
                        <div className="grid gap-2 sm:grid-cols-5">
                          {ratingScale.map((option, index) => (
                            <label key={option.value} className="space-y-1 text-xs">
                              <span>Rating {option.value}</span>
                              <input
                                className={fieldClass}
                                maxLength={60}
                                required
                                value={option.label}
                                onChange={(event) =>
                                  setRatingScale((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, label: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </section>
                      {builderCategories.map((category, categoryIndex) => (
                        <section
                          key={`${category.name}-${categoryIndex}`}
                          className="space-y-3 rounded-lg border bg-background p-3"
                        >
                          <div className="flex gap-2">
                            <input
                              className={fieldClass}
                              aria-label="Category name"
                              maxLength={120}
                              required
                              value={category.name}
                              onChange={(event) =>
                                setBuilderCategories((current) =>
                                  current.map((item, index) =>
                                    index === categoryIndex
                                      ? { ...item, name: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setBuilderCategories((current) =>
                                  current.filter((_, index) => index !== categoryIndex),
                                )
                              }
                            >
                              Delete category
                            </Button>
                          </div>
                          {category.questions.map((question, questionIndex) => (
                            <div
                              key={`${question.questionText}-${questionIndex}`}
                              className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto]"
                            >
                              <input
                                className={fieldClass}
                                aria-label={`Question in ${category.name}`}
                                maxLength={1000}
                                required
                                value={question.questionText}
                                onChange={(event) =>
                                  setBuilderCategories((current) =>
                                    current.map((item, index) =>
                                      index === categoryIndex
                                        ? {
                                            ...item,
                                            questions: item.questions.map((entry, entryIndex) =>
                                              entryIndex === questionIndex
                                                ? { ...entry, questionText: event.target.value }
                                                : entry,
                                            ),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={question.isRequired}
                                    onChange={(event) =>
                                      setBuilderCategories((current) =>
                                        current.map((item, index) =>
                                          index === categoryIndex
                                            ? {
                                                ...item,
                                                questions: item.questions.map(
                                                  (entry, entryIndex) =>
                                                    entryIndex === questionIndex
                                                      ? {
                                                          ...entry,
                                                          isRequired: event.target.checked,
                                                        }
                                                      : entry,
                                                ),
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  />
                                  Required
                                </label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={questionIndex === 0}
                                  aria-label="Move question up"
                                  onClick={() =>
                                    setBuilderCategories((current) =>
                                      current.map((item, index) => {
                                        if (index !== categoryIndex) return item;
                                        const questions = [...item.questions];
                                        [questions[questionIndex - 1], questions[questionIndex]] = [
                                          questions[questionIndex],
                                          questions[questionIndex - 1],
                                        ];
                                        return { ...item, questions };
                                      }),
                                    )
                                  }
                                >
                                  Up
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={questionIndex === category.questions.length - 1}
                                  aria-label="Move question down"
                                  onClick={() =>
                                    setBuilderCategories((current) =>
                                      current.map((item, index) => {
                                        if (index !== categoryIndex) return item;
                                        const questions = [...item.questions];
                                        [questions[questionIndex], questions[questionIndex + 1]] = [
                                          questions[questionIndex + 1],
                                          questions[questionIndex],
                                        ];
                                        return { ...item, questions };
                                      }),
                                    )
                                  }
                                >
                                  Down
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setBuilderCategories((current) =>
                                      current.map((item, index) =>
                                        index === categoryIndex
                                          ? {
                                              ...item,
                                              questions: item.questions.filter(
                                                (_, entryIndex) => entryIndex !== questionIndex,
                                              ),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setBuilderCategories((current) =>
                                current.map((item, index) =>
                                  index === categoryIndex
                                    ? {
                                        ...item,
                                        questions: [
                                          ...item.questions,
                                          {
                                            questionText: "",
                                            isRequired: true,
                                            questionType: "rating",
                                          },
                                        ],
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            Add question
                          </Button>
                        </section>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setBuilderCategories((current) => [
                            ...current,
                            { name: "", questions: [] },
                          ])
                        }
                      >
                        Add category
                      </Button>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => setBuilderStep(1)}>
                          Back
                        </Button>
                        <Button type="button" onClick={() => setBuilderStep(3)}>
                          Preview questionnaire
                        </Button>
                        <Button type="button" variant="outline" onClick={resetPeriodForm}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {builderStep === 3 && (
                    <div className="space-y-4 rounded-lg border bg-background p-4">
                      <div>
                        <h3 className="font-semibold">
                          {periodForm.title || "Evaluation questionnaire"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {
                            academicMetadata?.years.find(
                              (year) => year.id === periodForm.academicYearId,
                            )?.code
                          }
                          {" · "}
                          {
                            academicMetadata?.semesters.find(
                              (semester) => semester.id === periodForm.semesterId,
                            )?.name
                          }
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ratingScale.map((item) => `${item.value} ${item.label}`).join(" · ")}
                      </p>
                      {builderCategories.map((category, categoryIndex) => (
                        <section key={`${category.name}-${categoryIndex}`} className="space-y-2">
                          <h4 className="font-medium">{category.name || "Untitled category"}</h4>
                          {category.questions.map((question, questionIndex) => (
                            <div
                              key={`${question.questionText}-${questionIndex}`}
                              className="rounded border p-3"
                            >
                              <p className="text-sm">
                                {question.questionText || "Untitled question"}
                                {question.isRequired ? " *" : " (optional)"}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                                {ratingScale.map((item) => (
                                  <span key={item.value}>
                                    ◯ {item.value} · {item.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </section>
                      ))}
                      {["Faculty strengths", "Areas for improvement", "Additional comments"].map(
                        (label) => (
                          <label key={label} className="block space-y-1 text-sm">
                            <span>{label} (optional)</span>
                            <textarea
                              className={fieldClass}
                              rows={2}
                              disabled
                              placeholder="Student response"
                            />
                          </label>
                        ),
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => setBuilderStep(2)}>
                          Back to questions
                        </Button>
                        <Button type="button" onClick={() => setBuilderStep(4)}>
                          Continue to save and publish
                        </Button>
                      </div>
                    </div>
                  )}

                  {builderStep === 4 && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Saving as a draft keeps the questionnaire private. Publishing creates an
                        immutable version and opens it to eligible enrolled students during the
                        selected dates.
                      </p>
                      <p className="text-sm">
                        {builderCategories.reduce(
                          (total, category) => total + category.questions.length,
                          0,
                        )}{" "}
                        questions ·{" "}
                        {builderCategories.reduce(
                          (total, category) =>
                            total +
                            category.questions.filter((question) => question.isRequired).length,
                          0,
                        )}{" "}
                        required
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => setBuilderStep(3)}>
                          Back to preview
                        </Button>
                        <Button
                          type="button"
                          disabled={periodSaving}
                          onClick={() => void saveQuestionnaire(false)}
                        >
                          {periodSaving ? "Saving…" : "Save as Draft"}
                        </Button>
                        <Button
                          type="button"
                          disabled={periodSaving}
                          onClick={() => void saveQuestionnaire(true)}
                        >
                          {periodSaving ? "Publishing…" : "Publish and Activate"}
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
                    </div>
                  )}
                </div>
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
                      {assignment.completed ? "Completed" : "Pending"}
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
              No faculty evaluations are currently available for your enrolled subjects.
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
                  {!questionnaireCanSubmit ? (
                    <p className="text-sm text-destructive" role="alert">
                      The questionnaire is unavailable because it has no required questions.
                    </p>
                  ) : (
                    <>
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
                                    {question.questionText}
                                    {question.isRequired ? " *" : " (optional)"}
                                  </legend>
                                  <div className="flex flex-wrap gap-3">
                                    {(
                                      question.ratingScale ||
                                      ratingLabels.map((label, index) => ({
                                        value: index + 1,
                                        label,
                                      }))
                                    ).map(({ value: rating, label }) => {
                                      return (
                                        <label
                                          key={rating}
                                          className="flex items-center gap-1 text-sm"
                                        >
                                          <input
                                            type="radio"
                                            name={question.questionId}
                                            value={rating}
                                            required={Boolean(question.isRequired)}
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
                    <Button type="submit" disabled={submitting || !questionnaireCanSubmit}>
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
