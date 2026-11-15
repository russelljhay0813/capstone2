import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { motion } from "framer-motion";
import {
  fetchAcademicStructure,
  type AcademicStructure,
  fetchProgramsDetailed,
  createProgram,
  updateProgramApi,
  deleteProgramApi,
  fetchCurriculum,
  createCurriculumItem,
  deleteCurriculumItem,
  createSubject,
} from "@/lib/api";
import { YEAR_LEVELS, SEMESTERS } from "@/lib/subjects-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/registrar/curriculum")({
  component: RegistrarCurriculum,
});

function RegistrarCurriculum() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [academicStructure, setAcademicStructure] = useState<AcademicStructure>({
    academicYears: [],
    yearLevels: [],
    semesters: [],
  });
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);
  const [programForm, setProgramForm] = useState({ name: "", description: "" });
  const [subjectForm, setSubjectForm] = useState({
    yearLevel: "",
    semester: "",
    subjectCode: "",
    subjectTitle: "",
    units: 3,
  });

  const loadPrograms = async () => {
    try {
      const data = await fetchProgramsDetailed();
      setPrograms(Array.isArray(data) ? data : []);
    } catch {
      setPrograms([]);
    }
  };

  const loadCurriculum = async () => {
    try {
      const data = await fetchCurriculum();
      setCurriculum(Array.isArray(data) ? data : []);
    } catch {
      setCurriculum([]);
    }
  };

  useEffect(() => {
    loadPrograms();
    loadCurriculum();
    fetchAcademicStructure()
      .then((structure) => setAcademicStructure(structure))
      .catch(() => setAcademicStructure({ academicYears: [], yearLevels: [], semesters: [] }));
  }, []);

  useEffect(() => {
    if (academicStructure.yearLevels.length && !subjectForm.yearLevel) {
      setSubjectForm((prev) => ({ ...prev, yearLevel: academicStructure.yearLevels[0] }));
    }
    if (academicStructure.semesters.length && !subjectForm.semester) {
      setSubjectForm((prev) => ({ ...prev, semester: academicStructure.semesters[0] }));
    }
  }, [academicStructure, subjectForm.yearLevel, subjectForm.semester]);

  const handleCreateProgram = async () => {
    if (!programForm.name) return toast.error("Program name is required");
    try {
      await createProgram(programForm);
      toast.success("Program created");
      setShowProgramModal(false);
      setProgramForm({ name: "", description: "" });
      loadPrograms();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create program");
    }
  };

  const handleUpdateProgram = async () => {
    if (!selectedProgram || !programForm.name) return;
    try {
      await updateProgramApi(selectedProgram.id, programForm);
      toast.success("Program updated");
      setShowProgramModal(false);
      setSelectedProgram(null);
      setProgramForm({ name: "", description: "" });
      loadPrograms();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update program");
    }
  };

  const handleArchiveProgram = async (id: string) => {
    if (!confirm("Archive this program?")) return;
    try {
      await deleteProgramApi(id);
      toast.success("Program archived");
      loadPrograms();
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive program");
    }
  };

  const handleAddSubject = async () => {
    if (!selectedProgram || !subjectForm.subjectCode || !subjectForm.subjectTitle) {
      return toast.error("Subject code and title are required");
    }
    try {
      // First, check if subject exists by code (or create it)
      // Since we don't have a direct lookup, we'll create it (idempotent)
      const subject = await createSubject({
        code: subjectForm.subjectCode,
        title: subjectForm.subjectTitle,
        units: Number(subjectForm.units),
      });
      // Now link it to curriculum
      await createCurriculumItem({
        programId: selectedProgram.id,
        yearLevel: subjectForm.yearLevel || yearLevels[0],
        semester: subjectForm.semester || semesters[0],
        subjectId: subject.id,
      });
      toast.success("Subject added to curriculum");
      setShowSubjectModal(false);
      setSubjectForm({
        yearLevel: yearLevels[0],
        semester: semesters[0],
        subjectCode: "",
        subjectTitle: "",
        units: 3,
      });
      loadCurriculum();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add subject");
    }
  };

  const handleRemoveSubject = async (id: string) => {
    if (!confirm("Remove this subject from curriculum?")) return;
    try {
      await deleteCurriculumItem(id);
      toast.success("Subject removed");
      loadCurriculum();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove subject");
    }
  };

  const openEditProgram = (program: any) => {
    setSelectedProgram(program);
    setProgramForm({ name: program.name, description: program.description || "" });
    setShowProgramModal(true);
  };

  const yearLevels = academicStructure.yearLevels.length
    ? academicStructure.yearLevels
    : YEAR_LEVELS;
  const semesters = academicStructure.semesters.length ? academicStructure.semesters : SEMESTERS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Programs & Curriculum</h1>
          <p className="text-sm text-muted-foreground">
            Manage academic programs and curriculum subjects
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedProgram(null);
            setProgramForm({ name: "", description: "" });
            setShowProgramModal(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Create Program
        </Button>
      </div>

      {programs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No programs available</p>
        </div>
      ) : (
        <div className="space-y-6">
          {programs.map((program) => {
            const programCurriculum = curriculum.filter((c) => c.programId === program.id);
            return (
              <div key={program.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-base font-semibold text-foreground">
                    {program.name}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditProgram(program)}
                      className="rounded-lg border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5 inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => handleArchiveProgram(program.id)}
                      className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3.5 w-3.5 inline mr-1" /> Archive
                    </button>
                  </div>
                </div>
                {program.description && (
                  <p className="text-xs text-muted-foreground mb-4">{program.description}</p>
                )}
                <div className="space-y-4">
                  {yearLevels.map((year) => (
                    <div key={year}>
                      <h3 className="text-sm font-medium text-accent mb-2">{year}</h3>
                      <div className="space-y-3">
                        {semesters.map((sem) => {
                          const semesterSubjects = programCurriculum.filter(
                            (c) => c.yearLevel === year && c.semester === sem,
                          );
                          return (
                            <div key={sem} className="ml-4">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  {sem}
                                </p>
                                <button
                                  onClick={() => {
                                    setSelectedProgram(program);
                                    setSubjectForm({
                                      ...subjectForm,
                                      yearLevel: year,
                                      semester: sem,
                                    });
                                    setShowSubjectModal(true);
                                  }}
                                  className="text-xs text-accent hover:underline"
                                >
                                  + Add Subject
                                </button>
                              </div>
                              {semesterSubjects.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No subjects defined</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {semesterSubjects.map((subj) => (
                                    <div
                                      key={subj.id}
                                      className="inline-flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs"
                                    >
                                      <span className="text-foreground font-medium">
                                        {subj.subjectCode}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {subj.subjectTitle}
                                      </span>
                                      <span className="text-muted-foreground">
                                        ({subj.units} units)
                                      </span>
                                      <button
                                        onClick={() => handleRemoveSubject(subj.id)}
                                        className="text-destructive hover:text-destructive/80"
                                        aria-label={`Remove ${subj.subjectCode} from curriculum`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showProgramModal} onOpenChange={setShowProgramModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedProgram ? "Edit Program" : "Create Program"}</DialogTitle>
            <DialogDescription>
              {selectedProgram ? "Update program details" : "Add a new academic program"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label>Program Name</Label>
              <Input
                value={programForm.name}
                onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                placeholder="e.g., Bachelor of Science in Computer Science"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={programForm.description}
                onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProgramModal(false)}>
              Cancel
            </Button>
            <Button onClick={selectedProgram ? handleUpdateProgram : handleCreateProgram}>
              {selectedProgram ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubjectModal} onOpenChange={setShowSubjectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Curriculum Subject</DialogTitle>
            <DialogDescription>
              {selectedProgram ? selectedProgram.name : "Select a program"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Year Level</Label>
                <Select
                  value={subjectForm.yearLevel}
                  onValueChange={(v) => setSubjectForm({ ...subjectForm, yearLevel: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearLevels.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Semester</Label>
                <Select
                  value={subjectForm.semester}
                  onValueChange={(v) => setSubjectForm({ ...subjectForm, semester: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {semesters.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject Code</Label>
              <Input
                value={subjectForm.subjectCode}
                onChange={(e) => setSubjectForm({ ...subjectForm, subjectCode: e.target.value })}
                placeholder="e.g., CS 101"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject Title</Label>
              <Input
                value={subjectForm.subjectTitle}
                onChange={(e) => setSubjectForm({ ...subjectForm, subjectTitle: e.target.value })}
                placeholder="e.g., Introduction to Computing"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Units</Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={subjectForm.units}
                onChange={(e) => setSubjectForm({ ...subjectForm, units: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubjectModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSubject}>Add Subject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}