import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, Plus, Save } from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  createFacultyEvaluationPeriod,
  fetchAcademicMetadata,
  fetchEligibleFacultyEvaluations,
  fetchEvaluationCriteria,
  fetchEvaluationQuestions,
  fetchEvaluationQuestionsForPeriod,
  fetchFacultyEvaluationPeriods,
  fetchFacultyEvaluationReport,
  fetchMyFacultyEvaluationResults,
  saveEvaluationCriterion,
  saveEvaluationQuestion,
  submitFacultyEvaluation,
  updateFacultyEvaluationPeriod,
  type AcademicMetadata,
  type EligibleFacultyEvaluation,
  type EvaluationCriterion,
  type EvaluationPeriodQuestion,
  type EvaluationQuestion,
  type FacultyEvaluationPeriod,
  type FacultyEvaluationReport,
  type FacultyEvaluationReportGroup,
} from "@/lib/api";
import { toast } from "sonner";

type PortalRole = "admin" | "registrar" | "student" | "faculty";

const fieldClass = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const ratingLabels: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Satisfactory",
  4: "Very Satisfactory",
  5: "Excellent",
};

function downloadReport(groups: FacultyEvaluationReportGroup[]) {
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const categories = [...new Set(groups.flatMap((group) => group.categories.map((item) => item.category)))];
  const headers = [
    "Evaluation period",
    "Faculty",
    "Subject",
    "Academic year",
    "Semester",
    "Valid responses",
    "Overall average",
    "Interpretation",
    ...categories,
  ];
  const rows = groups.map((group) => {
    const categoryAverages = new Map(group.categories.map((item) => [item.category, item.average]));
    return [
      group.evaluationTitle,
      group.facultyName,
      `${group.subjectCode} - ${group.subjectTitle}`,
      group.academicYear,
      group.semester,
      group.responseCount,
      group.overallAverage,
      group.interpretation,
      ...categories.map((category) => categoryAverages.get(category) ?? ""),
    ];
  });
  const blob = new Blob(
    [[headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "faculty-evaluation-report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadReportPdf(groups: FacultyEvaluationReportGroup[]) {
  const document = new jsPDF();
  let y = 18;
  document.setFontSize(16);
  document.text("Faculty Evaluation Report", 14, y);
  y += 10;
  document.setFontSize(9);
  for (const group of groups) {
    if (y > 265) {
      document.addPage();
      y = 18;
    }
    document.setFont("helvetica", "bold");
    document.text(`${group.facultyName} — ${group.subjectCode} ${group.subjectTitle}`, 14, y);
    y += 5;
    document.setFont("helvetica", "normal");
    document.text(
      `${group.evaluationTitle} | ${group.academicYear} ${group.semester} | ${group.responseCount} responses`,
      14,
      y,
    );
    y += 5;
    document.text(
      `Overall: ${group.overallAverage.toFixed(2)} (${group.interpretation})`,
      14,
      y,
    );
    y += 5;
    for (const category of group.categories) {
      if (y > 275) {
        document.addPage();
        y = 18;
      }
      document.text(`${category.category}: ${category.average.toFixed(2)} (${category.interpretation})`, 18, y);
      y += 5;
    }
    y += 5;
  }
  document.save("faculty-evaluation-report.pdf");
}

export function FacultyEvaluationPortal({ role }: { role: PortalRole }) {
  const { user, isHydrated } = useAuth();
  const [periods, setPeriods] = useState<FacultyEvaluationPeriod[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [metadata, setMetadata] = useState<AcademicMetadata | null>(null);
  const [report, setReport] = useState<FacultyEvaluationReport | null>(null);
  const [eligible, setEligible] = useState<EligibleFacultyEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [periodForm, setPeriodForm] = useState({
    title: "",
    academicYearId: "",
    semesterId: "",
    startDate: "",
    endDate: "",
  });
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState({
    criteriaId: "",
    questionText: "",
    isRequired: true,
  });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EligibleFacultyEvaluation | null>(null);
  const [formQuestions, setFormQuestions] = useState<EvaluationPeriodQuestion[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");

  const loadAdminData = useCallback(async () => {
    const [periodData, criterionData, questionData, metadataData] = await Promise.all([
      fetchFacultyEvaluationPeriods(),
      fetchEvaluationCriteria(),
      fetchEvaluationQuestions(),
      fetchAcademicMetadata(),
    ]);
    setPeriods(periodData);
    setCriteria(criterionData);
    setQuestions(questionData);
    setMetadata(metadataData);
    setPeriodForm((current) => ({
      ...current,
      academicYearId: current.academicYearId || metadataData.years[0]?.id || "",
      semesterId:
        current.semesterId ||
        metadataData.semesters.find((item) => item.academicYearId === metadataData.years[0]?.id)?.id ||
        "",
    }));
  }, []);

  const reportFilters = useMemo(
    () => ({
      evaluationId: selectedPeriodId || undefined,
      academicYearId: selectedYearId || undefined,
      semesterId: selectedSemesterId || undefined,
      programId: selectedProgramId || undefined,
      facultyId: selectedFacultyId || undefined,
      subjectOfferingId: selectedOfferingId || undefined,
    }),
    [selectedFacultyId, selectedOfferingId, selectedPeriodId, selectedProgramId, selectedSemesterId, selectedYearId],
  );
  const questionGroups = useMemo(() => {
    const groups = new Map<string, EvaluationPeriodQuestion[]>();
    for (const question of formQuestions) {
      const current = groups.get(question.criteriaId) || [];
      current.push(question);
      groups.set(question.criteriaId, current);
    }
    return [...groups.entries()].map(([criteriaId, items]) => ({
      criteriaId,
      category: items[0]?.category || "Evaluation",
      questions: items,
    }));
  }, [formQuestions]);

  const loadReport = useCallback(async () => {
    const data =
      role === "faculty"
        ? await fetchMyFacultyEvaluationResults()
        : await fetchFacultyEvaluationReport(reportFilters);
    setReport(data);
    if (!selectedPeriodId && data.periods[0]?.id) setSelectedPeriodId(data.periods[0].id);
  }, [reportFilters, role, selectedPeriodId]);

  const loadEligible = useCallback(async () => {
    setEligible(await fetchEligibleFacultyEvaluations());
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (role === "admin") {
        await Promise.all([loadAdminData(), loadReport()]);
      } else if (role === "registrar") {
        const [metadataData, periodData] = await Promise.all([
          fetchAcademicMetadata(),
          fetchFacultyEvaluationPeriods(),
        ]);
        setMetadata(metadataData);
        setPeriods(periodData);
        await loadReport();
      } else if (role === "student") {
        await loadEligible();
      } else {
        await loadReport();
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load evaluation data.");
    } finally {
      setLoading(false);
    }
  }, [loadAdminData, loadEligible, loadReport, role]);

  useEffect(() => {
    if (!isHydrated || user?.role !== role) return;
    void refresh();
  }, [isHydrated, refresh, role, user?.role]);

  useEffect(() => {
    if (!isHydrated || (role !== "admin" && role !== "registrar")) return;
    let current = true;
    fetchFacultyEvaluationReport(reportFilters)
      .then((data) => {
        if (current) setReport(data);
      })
      .catch((loadError: unknown) => {
        if (current) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load evaluation reports.");
        }
      });
    return () => {
      current = false;
    };
  }, [isHydrated, reportFilters, role]);

  const activePeriod = periods.find((period) => period.status === "active");
  const completedCount = report?.completion.reduce(
    (total, item) => total + (item.completedCount ?? 0),
    0,
  );
  const eligibleCount = report?.completion.reduce(
    (total, item) => total + (item.eligibleCount ?? 0),
    0,
  );
  const completionSuppressed = Boolean(report?.completion.some((item) => item.suppressed));
  const completionPercent =
    eligibleCount && completedCount !== undefined && !completionSuppressed
      ? Math.round((completedCount / eligibleCount) * 100)
      : null;

  const notifyError = (actionError: unknown, fallback: string) => {
    const message = actionError instanceof Error ? actionError.message : fallback;
    toast.error(message);
    setError(message);
  };

  const savePeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingPeriodId) {
        await updateFacultyEvaluationPeriod(editingPeriodId, periodForm);
      } else {
        await createFacultyEvaluationPeriod(periodForm);
      }
      setPeriodForm((current) => ({ ...current, title: "", startDate: "", endDate: "" }));
      setEditingPeriodId(null);
      toast.success(editingPeriodId ? "Evaluation period updated." : "Evaluation period created as a draft.");
      await refresh();
    } catch (actionError) {
      notifyError(actionError, "Unable to create the evaluation period.");
    } finally {
      setSaving(false);
    }
  };

  const startPeriodEdit = (period: FacultyEvaluationPeriod) => {
    setEditingPeriodId(period.id);
    setPeriodForm({
      title: period.title,
      academicYearId: period.academicYearId,
      semesterId: period.semesterId,
      startDate: period.startDate,
      endDate: period.endDate,
    });
  };

  const changePeriodStatus = async (period: FacultyEvaluationPeriod) => {
    setSaving(true);
    try {
      await updateFacultyEvaluationPeriod(period.id, {
        status: period.status === "active" ? "closed" : "active",
      });
      toast.success(period.status === "active" ? "Evaluation period closed." : "Evaluation period activated.");
      await refresh();
    } catch (actionError) {
      notifyError(actionError, "Unable to update the evaluation period.");
    } finally {
      setSaving(false);
    }
  };

  const saveQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveEvaluationQuestion(questionDraft, editingQuestionId || undefined);
      setQuestionDraft({ criteriaId: "", questionText: "", isRequired: true });
      setEditingQuestionId(null);
      toast.success(editingQuestionId ? "Question updated." : "Question added.");
      await loadAdminData();
    } catch (actionError) {
      notifyError(actionError, "Unable to save the evaluation question.");
    } finally {
      setSaving(false);
    }
  };

  const startQuestionEdit = (question: EvaluationQuestion) => {
    setEditingQuestionId(question.id);
    setQuestionDraft({
      criteriaId: question.criteriaId,
      questionText: question.questionText,
      isRequired: Boolean(question.isRequired),
    });
  };

  const toggleQuestion = async (question: EvaluationQuestion) => {
    try {
      await saveEvaluationQuestion(
        {
          criteriaId: question.criteriaId,
          questionText: question.questionText,
          isRequired: Boolean(question.isRequired),
          displayOrder: question.displayOrder,
          isActive: question.isActive ? 0 : 1,
        },
        question.id,
      );
      await loadAdminData();
    } catch (actionError) {
      notifyError(actionError, "Unable to update the question.");
    }
  };

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveEvaluationCriterion(
        { name: categoryName, displayOrder: criteria.length + 1 },
        editingCategoryId || undefined,
      );
      setCategoryName("");
      setEditingCategoryId(null);
      await loadAdminData();
    } catch (actionError) {
      notifyError(actionError, "Unable to add the category.");
    }
  };

  const toggleCategory = async (category: EvaluationCriterion) => {
    try {
      await saveEvaluationCriterion(
        { name: category.name, description: category.description, displayOrder: category.displayOrder, isActive: category.isActive ? 0 : 1 },
        category.id,
      );
      await loadAdminData();
    } catch (actionError) {
      notifyError(actionError, "Unable to update the category.");
    }
  };

  const openEvaluation = async (item: EligibleFacultyEvaluation) => {
    try {
      const loadedQuestions = await fetchEvaluationQuestionsForPeriod(item.evaluationId);
      setSelectedEvaluation(item);
      setFormQuestions(loadedQuestions);
      setRatings({});
      setFeedback("");
    } catch (loadError) {
      notifyError(loadError, "Unable to load evaluation questions.");
    }
  };

  const submitEvaluation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEvaluation) return;
    setSaving(true);
    try {
      await submitFacultyEvaluation({
        evaluationId: selectedEvaluation.evaluationId,
        subjectOfferingId: selectedEvaluation.subjectOfferingId,
        answers: formQuestions
          .filter((question) => ratings[question.questionId])
          .map((question) => ({ questionId: question.questionId, rating: ratings[question.questionId] })),
        feedback,
      });
      toast.success("Your evaluation was submitted anonymously.");
      setSelectedEvaluation(null);
      await loadEligible();
    } catch (actionError) {
      notifyError(actionError, "Unable to submit your evaluation.");
    } finally {
      setSaving(false);
    }
  };

  if (!isHydrated || user?.role !== role) {
    return <p className="text-sm text-muted-foreground">Authorized {role} access is required.</p>;
  }

  const titleByRole: Record<PortalRole, string> = {
    admin: "Faculty Evaluation Management",
    registrar: "Evaluation Monitoring",
    student: "Faculty Evaluation",
    faculty: "My Evaluation Results",
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-xl font-bold text-foreground">{titleByRole[role]}</h1>
        <p className="text-sm text-muted-foreground">
          {role === "student"
            ? "Evaluate only faculty members assigned to your enrolled subjects. Responses are anonymous."
            : "Evaluation results are aggregated and hidden for groups with fewer than five responses."}
        </p>
      </header>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}

      {role === "admin" && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Evaluation periods" value={periods.length} />
            <Metric label="Active period" value={activePeriod?.title || "None"} />
            <Metric label="Completed evaluations" value={completionSuppressed ? "Suppressed" : completedCount ?? "Suppressed"} />
            <Metric label="Completion" value={completionPercent === null ? "Suppressed" : `${completionPercent}%`} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-4 font-heading text-sm font-semibold">Create evaluation period</h2>
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={savePeriod}>
                <input className={`${fieldClass} sm:col-span-2`} required placeholder="Evaluation title" value={periodForm.title} onChange={(event) => setPeriodForm({ ...periodForm, title: event.target.value })} />
                <select className={fieldClass} required value={periodForm.academicYearId} onChange={(event) => {
                  const yearId = event.target.value;
                  setPeriodForm({
                    ...periodForm,
                    academicYearId: yearId,
                    semesterId: metadata?.semesters.find((semester) => semester.academicYearId === yearId)?.id || "",
                  });
                }}>
                  <option value="">Academic year</option>
                  {metadata?.years.filter((year) => year.status === "active").map((year) => <option key={year.id} value={year.id}>{year.code}</option>)}
                </select>
                <select className={fieldClass} required value={periodForm.semesterId} onChange={(event) => setPeriodForm({ ...periodForm, semesterId: event.target.value })}>
                  <option value="">Semester</option>
                  {metadata?.semesters.filter((semester) => semester.academicYearId === periodForm.academicYearId).map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
                </select>
                <label className="text-xs text-muted-foreground">Start date<input className={fieldClass} required type="date" value={periodForm.startDate} onChange={(event) => setPeriodForm({ ...periodForm, startDate: event.target.value })} /></label>
                <label className="text-xs text-muted-foreground">End date<input className={fieldClass} required type="date" value={periodForm.endDate} onChange={(event) => setPeriodForm({ ...periodForm, endDate: event.target.value })} /></label>
                <Button className="sm:col-span-2" disabled={saving}><Plus className="mr-2 h-4 w-4" />{editingPeriodId ? "Save period" : "Create draft period"}</Button>
                {editingPeriodId && <Button className="sm:col-span-2" type="button" variant="ghost" onClick={() => { setEditingPeriodId(null); setPeriodForm({ title: "", academicYearId: metadata?.years[0]?.id || "", semesterId: "", startDate: "", endDate: "" }); }}>Cancel editing</Button>}
              </form>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-4 font-heading text-sm font-semibold">Evaluation periods</h2>
              <div className="space-y-2">
                {periods.length === 0 && <p className="text-sm text-muted-foreground">No evaluation periods have been created.</p>}
                {periods.map((period) => (
                  <div key={period.id} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-medium">{period.title}</p><p className="text-xs text-muted-foreground">{period.academicYear} · {period.semester} · {period.startDate}–{period.endDate} · {period.status}</p></div>
                    <div className="flex gap-2">
                      {period.status !== "active" && <Button size="sm" variant="outline" onClick={() => startPeriodEdit(period)}>Edit</Button>}
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => void changePeriodStatus(period)}>{period.status === "active" ? "Close" : "Activate"}</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-sm font-semibold">Evaluation categories</h2>
              <form className="flex gap-2" onSubmit={addCategory}>
                <input className={fieldClass} required placeholder="New category" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
                <Button type="submit" variant="outline" aria-label={editingCategoryId ? "Save category" : "Add category"}><Plus className="h-4 w-4" /></Button>
                {editingCategoryId && <Button type="button" variant="ghost" onClick={() => { setEditingCategoryId(null); setCategoryName(""); }}>Cancel</Button>}
              </form>
              {criteria.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
                  <span>{category.name}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingCategoryId(category.id); setCategoryName(category.name); }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => void toggleCategory(category)}>{category.isActive ? "Deactivate" : "Activate"}</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-sm font-semibold">Questionnaire</h2>
              <form className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]" onSubmit={saveQuestion}>
                <select className={fieldClass} required value={questionDraft.criteriaId} onChange={(event) => setQuestionDraft({ ...questionDraft, criteriaId: event.target.value })}>
                  <option value="">Category</option>
                  {criteria.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <input className={fieldClass} required placeholder="Evaluation question" value={questionDraft.questionText} onChange={(event) => setQuestionDraft({ ...questionDraft, questionText: event.target.value })} />
                <Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />{editingQuestionId ? "Save" : "Add"}</Button>
                <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={questionDraft.isRequired} onChange={(event) => setQuestionDraft({ ...questionDraft, isRequired: event.target.checked })} />Required question</label>
                {editingQuestionId && <Button className="sm:col-span-3" type="button" variant="ghost" onClick={() => { setEditingQuestionId(null); setQuestionDraft({ criteriaId: "", questionText: "", isRequired: true }); }}>Cancel editing</Button>}
              </form>
              <div className="max-h-80 space-y-2 overflow-auto">
                {questions.map((question) => (
                  <div key={question.id} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm">{question.questionText}</p><p className="text-xs text-muted-foreground">{question.category} · {question.isRequired ? "Required" : "Optional"} · {question.isActive ? "Active" : "Inactive"}</p></div>
                    <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startQuestionEdit(question)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => void toggleQuestion(question)}>{question.isActive ? "Deactivate" : "Activate"}</Button></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {role === "student" && (
        <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-heading text-sm font-semibold">Your eligible faculty assignments</h2>
          {loading && <p className="text-sm text-muted-foreground">Loading your enrollments…</p>}
          {!loading && eligible.length === 0 && <p className="text-sm text-muted-foreground">There are no open evaluation periods for your assigned subjects.</p>}
          {eligible.map((item) => (
            <div key={`${item.evaluationId}:${item.subjectOfferingId}`} className="flex flex-col gap-3 rounded-lg bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{item.facultyName}</p><p className="text-sm text-muted-foreground">{item.subjectCode} · {item.subjectTitle} · {item.evaluationTitle}</p><p className="text-xs text-muted-foreground">{item.academicYear} · {item.semester}</p></div>
            {item.completed ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">Completed</span> : item.canSubmit ? <Button onClick={() => void openEvaluation(item)}>Evaluate</Button> : <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{item.periodStatus === "closed" || item.endDate < new Date().toISOString().slice(0, 10) ? "Closed" : `Opens ${item.startDate}`}</span>}
            </div>
          ))}
          {selectedEvaluation && (
            <form className="space-y-4 rounded-xl border p-4" onSubmit={submitEvaluation}>
              <div><h3 className="font-semibold">{selectedEvaluation.facultyName}</h3><p className="text-sm text-muted-foreground">{selectedEvaluation.subjectCode} · {selectedEvaluation.evaluationTitle}</p></div>
              {questionGroups.map((group) => (
                <fieldset key={group.criteriaId} className="space-y-3 rounded-lg border p-3">
                  <legend className="px-1 text-sm font-semibold">{group.category}</legend>
                  {group.questions.map((question) => (
                    <label key={question.questionId} className="grid gap-2 border-b pb-3 text-sm last:border-0 sm:grid-cols-[1fr_220px] sm:items-center">
                      <span>{question.questionText}{question.isRequired ? " *" : ""}</span>
                      <select className={fieldClass} required={Boolean(question.isRequired)} value={ratings[question.questionId] || ""} onChange={(event) => setRatings({ ...ratings, [question.questionId]: Number(event.target.value) })}>
                        <option value="">Select a rating</option>
                        {Object.entries(ratingLabels).map(([rating, label]) => <option key={rating} value={rating}>{rating} — {label}</option>)}
                      </select>
                    </label>
                  ))}
                </fieldset>
              ))}
              <label className="block text-sm">Optional written feedback<textarea className={`${fieldClass} mt-1 min-h-24`} maxLength={2000} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label>
              <div className="flex gap-2"><Button disabled={saving}>{saving ? "Submitting…" : "Submit anonymously"}</Button><Button type="button" variant="outline" onClick={() => setSelectedEvaluation(null)}>Cancel</Button></div>
            </form>
          )}
        </section>
      )}

      {(role === "admin" || role === "registrar") && (
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div><h2 className="font-heading text-sm font-semibold">Aggregated faculty results</h2><p className="text-xs text-muted-foreground">Individual responses and respondent identities are never included.</p></div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!report?.groups.length} onClick={() => report && downloadReport(report.groups)}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
              <Button variant="outline" disabled={!report?.groups.length} onClick={() => report && downloadReportPdf(report.groups)}><Download className="mr-2 h-4 w-4" />Export PDF</Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select className={fieldClass} value={selectedPeriodId} onChange={(event) => setSelectedPeriodId(event.target.value)}><option value="">All periods</option>{report?.periods.map((period) => <option key={period.id} value={period.id}>{period.title}</option>)}</select>
            <select className={fieldClass} value={selectedYearId} onChange={(event) => setSelectedYearId(event.target.value)}><option value="">All academic years</option>{metadata?.years.map((year) => <option key={year.id} value={year.id}>{year.code}</option>)}</select>
            <select className={fieldClass} value={selectedSemesterId} onChange={(event) => setSelectedSemesterId(event.target.value)}><option value="">All semesters</option>{metadata?.semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}</select>
            <select className={fieldClass} value={selectedProgramId} onChange={(event) => setSelectedProgramId(event.target.value)}><option value="">All programs</option>{metadata?.programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select>
            <select className={fieldClass} value={selectedFacultyId} onChange={(event) => setSelectedFacultyId(event.target.value)}><option value="">All reportable faculty</option>{[...new Map((report?.groups || []).map((group) => [group.facultyId, group.facultyName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
            <select className={fieldClass} value={selectedOfferingId} onChange={(event) => setSelectedOfferingId(event.target.value)}><option value="">All reportable subjects</option>{[...new Map((report?.groups || []).map((group) => [group.subjectOfferingId, `${group.subjectCode} · ${group.subjectTitle}`])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          </div>
          <div className="space-y-2">
            {report?.completion.map((item) => {
              const period = report.periods.find((candidate) => candidate.id === item.evaluationId);
              return <div key={item.evaluationId} className="rounded-lg bg-muted/40 p-3 text-sm"><span className="font-medium">{period?.title || "Evaluation period"}: </span>{item.suppressed ? <span className="text-muted-foreground">Completion details suppressed until at least five eligible students have responded.</span> : <span>{item.completedCount}/{item.eligibleCount} completed · {item.percentage}%</span>}</div>;
            })}
          </div>
          <ReportTable groups={report?.groups || []} loading={loading} />
        </section>
      )}

      {role === "faculty" && (
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Written feedback is withheld because an institutional feedback-disclosure policy is not configured.</p>
          <div className="space-y-3">
            <h2 className="font-heading text-sm font-semibold">Overall ratings by semester</h2>
            {(report?.groups || []).map((group) => (
              <RatingBar
                key={`${group.evaluationId}:${group.subjectOfferingId}`}
                label={`${group.academicYear} · ${group.semester} · ${group.subjectCode}`}
                average={group.overallAverage}
              />
            ))}
            {!report?.groups.length && <p className="text-sm text-muted-foreground">No reportable trends are available yet.</p>}
          </div>
          <ReportTable groups={report?.groups || []} loading={loading} />
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border bg-card p-4 shadow-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate font-heading text-lg font-bold">{value}</p></div>;
}

function RatingBar({ label, average }: { label: string; average: number }) {
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-[220px_1fr_48px] sm:items-center">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${average.toFixed(2)} out of 5`}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${(average / 5) * 100}%` }} />
      </div>
      <span className="font-medium">{average.toFixed(2)} / 5</span>
    </div>
  );
}

function ReportTable({ groups, loading }: { groups: FacultyEvaluationReportGroup[]; loading: boolean }) {
  if (loading) return <p className="py-6 text-center text-sm text-muted-foreground">Loading evaluation results…</p>;
  if (groups.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No reportable groups are available. Detailed results require at least five responses per faculty-subject assignment.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead><tr className="border-b text-xs text-muted-foreground"><th className="p-3">Faculty / subject</th><th className="p-3">Period</th><th className="p-3">Responses</th><th className="p-3">Overall</th><th className="p-3">Category averages</th></tr></thead>
        <tbody>
          {groups.map((group) => (
            <tr key={`${group.evaluationId}:${group.subjectOfferingId}`} className="border-b last:border-0">
              <td className="p-3"><p className="font-medium">{group.facultyName}</p><p className="text-xs text-muted-foreground">{group.subjectCode} · {group.subjectTitle}</p><p className="text-xs text-muted-foreground">{group.programName || "Program unavailable"}</p></td>
              <td className="p-3">{group.evaluationTitle}<p className="text-xs text-muted-foreground">{group.academicYear} · {group.semester}</p></td>
              <td className="p-3">{group.responseCount}</td>
              <td className="p-3">{group.overallAverage.toFixed(2)}<p className="text-xs text-muted-foreground">{group.interpretation}</p></td>
              <td className="p-3"><div className="space-y-2">{group.categories.map((category) => <div key={category.criteriaId} className="space-y-1"><p className="text-xs">{category.category}: {category.average.toFixed(2)} ({category.interpretation})</p><div className="h-1.5 w-36 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${category.category}: ${category.average.toFixed(2)} out of 5`}><div className="h-full rounded-full bg-primary" style={{ width: `${(category.average / 5) * 100}%` }} /></div></div>)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
