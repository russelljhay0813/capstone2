import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, UserPlus } from "lucide-react";
import {
  assignSubjectOfferings,
  fetchUsers as fetchFacultyUsers,
  fetchSubjectOfferings,
  updateSubjectOffering,
} from "@/lib/api";
import type { UserAccount } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard/registrar/faculty")({
  component: RegistrarFaculty,
});

function RegistrarFaculty() {
  const [faculty, setFaculty] = useState<UserAccount[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState<UserAccount | null>(null);
  const [assignModal, setAssignModal] = useState(false);
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<string[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedYearLevel, setSelectedYearLevel] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [reassignModal, setReassignModal] = useState(false);
  const [reassignOffering, setReassignOffering] = useState<any | null>(null);
  const [newFacultyId, setNewFacultyId] = useState("");

  const loadData = async () => {
    try {
      const [f, o] = await Promise.all([fetchFacultyUsers("faculty"), fetchSubjectOfferings()]);
      setFaculty(f);
      setOfferings(o);
    } catch {
      setFaculty([]);
      setOfferings([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getFacultyOfferings = (facultyId: string) =>
    offerings.filter((o) => o.facultyId === facultyId);
  const getTotalUnits = (facultyId: string) =>
    getFacultyOfferings(facultyId).reduce((sum, o) => sum + o.units, 0);

  const filteredFaculty = faculty.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch =
      `${f.firstName} ${f.lastName}`.toLowerCase().includes(q) ||
      f.userId.toLowerCase().includes(q) ||
      (f.email && f.email.toLowerCase().includes(q));
    return matchSearch;
  });

  const handleAssign = async () => {
    const errors: string[] = [];
    if (!selectedFaculty) {
      errors.push("Select a faculty member before assigning.");
    }
    if (selectedOfferingIds.length === 0) {
      errors.push("Please select at least one subject offering.");
    }
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      const result = await assignSubjectOfferings(
        selectedFaculty!.facultyId || selectedFaculty!.id,
        selectedOfferingIds,
      );
      const facultyName = `${selectedFaculty!.firstName} ${selectedFaculty!.lastName}`;
      toast.success(`${result.totalAssigned} subjects successfully assigned to ${facultyName}.`);
      setAssignModal(false);
      setSelectedFaculty(null);
      setSelectedOfferingIds([]);
      setSelectedAcademicYear("");
      setSelectedProgram("");
      setSelectedYearLevel("");
      setSelectedSemester("");
      setSelectedSection("");
      setSubjectSearch("");
      setValidationErrors([]);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign offering");
    }
  };

  const handleReassign = async () => {
    if (!reassignOffering || !newFacultyId) return;
    try {
      const targetFaculty = faculty.find((item) => item.id === newFacultyId);
      await updateSubjectOffering(reassignOffering.id, {
        facultyId: targetFaculty?.facultyId || newFacultyId,
      });
      toast.success("Subject offering reassigned");
      setReassignModal(false);
      setReassignOffering(null);
      setNewFacultyId("");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reassign offering");
    }
  };

  const openAssignModal = (fac: UserAccount) => {
    setSelectedFaculty(fac);
    setSelectedOfferingIds([]);
    setSelectedAcademicYear("");
    setSelectedProgram("");
    setSelectedYearLevel("");
    setSelectedSemester("");
    setSelectedSection("");
    setSubjectSearch("");
    setValidationErrors([]);
    setAssignModal(true);
  };

  const openReassignModal = (offering: any) => {
    setReassignOffering(offering);
    setNewFacultyId("");
    setReassignModal(true);
  };

  const unassignedOfferings = offerings.filter((o) => !o.facultyId);
  const availableOfferingPool = offerings.filter((o) => o.status === "active");
  const availableAcademicYears = Array.from(
    new Set(availableOfferingPool.map((o) => o.academicYearCode).filter(Boolean)),
  ).sort();
  const availablePrograms = Array.from(
    new Set(availableOfferingPool.map((o) => o.programName).filter(Boolean)),
  ).sort();
  const filteredBeforeYear = availableOfferingPool.filter(
    (o) => !selectedAcademicYear || o.academicYearCode === selectedAcademicYear,
  );
  const availableYearLevels = selectedProgram
    ? Array.from(
        new Set(
          filteredBeforeYear
            .filter((o) => o.programName === selectedProgram)
            .map((o) => o.yearLevel)
            .filter(Boolean),
        ),
      ).sort()
    : [];
  const availableSemesters = selectedProgram && selectedYearLevel
      ? Array.from(
          new Set(
            filteredBeforeYear
              .filter(
                (o) => o.programName === selectedProgram && o.yearLevel === selectedYearLevel,
              )
              .map((o) => o.semesterName)
              .filter(Boolean),
          ),
        ).sort()
      : [];
  const availableSections = selectedProgram && selectedYearLevel && selectedSemester
    ? Array.from(
        new Set(
          filteredBeforeYear
            .filter(
              (o) =>
                o.programName === selectedProgram &&
                o.yearLevel === selectedYearLevel &&
                o.semesterName === selectedSemester,
            )
            .map((o) => o.sectionName)
            .filter(Boolean),
        ),
      ).sort()
    : [];
  const availableOfferings =
    selectedProgram && selectedYearLevel && selectedSemester
      ? filteredBeforeYear.filter(
          (o) =>
            o.programName === selectedProgram &&
            o.yearLevel === selectedYearLevel &&
            o.semesterName === selectedSemester &&
            (!selectedSection || o.sectionName === selectedSection) &&
            (o.subjectCode.toLowerCase().includes(subjectSearch.toLowerCase()) ||
              o.subjectTitle.toLowerCase().includes(subjectSearch.toLowerCase())),
        )
      : [];
  const selectableOfferings = availableOfferings.filter(
    (o) => !o.facultyId || o.facultyId === selectedFaculty?.facultyId,
  );
  const selectedCount = selectedOfferingIds.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Faculty Assignment</h1>
        <p className="text-sm text-muted-foreground">
          Manage faculty subject assignments and workloads
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Faculty</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{faculty.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Unassigned Subject Offerings</p>
          <p className="mt-1 font-heading text-2xl font-bold text-warning">
            {unassignedOfferings.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Subject Offerings</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{offerings.length}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by faculty name or ID..."
          className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Faculty ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Faculty Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Department</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Assigned Offerings
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Current Load (Units)
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFaculty.map((f, i) => {
              const assigned = getFacultyOfferings(f.facultyId || f.id);
              return (
                <motion.tr
                  key={f.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{f.userId}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {f.firstName} {f.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{f.program || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {assigned.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        assigned.map((o) => (
                          <span
                            key={o.id}
                            className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                          >
                            {o.subjectCode}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{getTotalUnits(f.facultyId || f.id)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openAssignModal(f)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Assign
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
            {filteredFaculty.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No faculty found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={assignModal} onOpenChange={setAssignModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Assign Subjects</DialogTitle>
            <DialogDescription>
              Select one or more subject offerings for {selectedFaculty?.firstName} {selectedFaculty?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {validationErrors.map((error) => <p key={error}>{error}</p>)}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select value={selectedAcademicYear} onValueChange={(value) => { setSelectedAcademicYear(value); setSelectedSection(""); setSelectedOfferingIds([]); }}>
                  <SelectTrigger><SelectValue placeholder="All Academic Years" /></SelectTrigger>
                  <SelectContent>{availableAcademicYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Program</Label>
                <Select value={selectedProgram} onValueChange={(value) => { setSelectedProgram(value); setSelectedYearLevel(""); setSelectedSemester(""); setSelectedSection(""); setSelectedOfferingIds([]); }}>
                  <SelectTrigger><SelectValue placeholder="Select Program" /></SelectTrigger>
                  <SelectContent>{availablePrograms.map((program) => <SelectItem key={program} value={program}>{program}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year Level</Label>
                <Select value={selectedYearLevel} onValueChange={(value) => { setSelectedYearLevel(value); setSelectedSemester(""); setSelectedSection(""); setSelectedOfferingIds([]); }}>
                  <SelectTrigger><SelectValue placeholder="Select Year Level" /></SelectTrigger>
                  <SelectContent>{availableYearLevels.map((yearLevel) => <SelectItem key={yearLevel} value={yearLevel}>{yearLevel}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Semester</Label>
                <Select value={selectedSemester} onValueChange={(value) => { setSelectedSemester(value); setSelectedSection(""); setSelectedOfferingIds([]); }}>
                  <SelectTrigger><SelectValue placeholder="Select Semester" /></SelectTrigger>
                  <SelectContent>{availableSemesters.map((semester) => <SelectItem key={semester} value={semester}>{semester}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Select value={selectedSection} onValueChange={(value) => { setSelectedSection(value); setSelectedOfferingIds([]); }}>
                  <SelectTrigger><SelectValue placeholder="All Sections" /></SelectTrigger>
                  <SelectContent>{availableSections.map((section) => <SelectItem key={section} value={section}>{section}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Subject Offerings ({selectedCount} selected)</Label>
                <div className="flex gap-2">
                  <button type="button" className="text-xs font-medium text-accent hover:underline disabled:opacity-50" disabled={selectableOfferings.length === 0} onClick={() => setSelectedOfferingIds(selectableOfferings.map((o) => o.id))}>Select All</button>
                  <button type="button" className="text-xs font-medium text-muted-foreground hover:underline disabled:opacity-50" disabled={selectedCount === 0} onClick={() => setSelectedOfferingIds([])}>Clear Selection</button>
                </div>
              </div>
              <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Search by code or title" value={subjectSearch} onChange={(e) => setSubjectSearch(e.target.value)} disabled={!selectedProgram || !selectedYearLevel || !selectedSemester} />
              <div className="max-h-72 overflow-y-auto rounded-lg border">
                {availableOfferings.length > 0 ? availableOfferings.map((o) => {
                  const isAssignedToOther = Boolean(o.facultyId && o.facultyId !== selectedFaculty?.facultyId);
                  return (
                    <label key={o.id} className="flex cursor-pointer gap-3 border-b p-3 last:border-b-0 hover:bg-muted/30">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={selectedOfferingIds.includes(o.id)} disabled={isAssignedToOther} onChange={(event) => setSelectedOfferingIds((current) => event.target.checked ? [...current, o.id] : current.filter((id) => id !== o.id))} />
                      <span className="min-w-0 flex-1 text-xs">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-foreground"><span>{o.subjectCode} — {o.subjectTitle}</span><span className="text-muted-foreground">{o.units} units</span></span>
                        <span className="mt-1 block text-muted-foreground">{o.programName} · {o.yearLevel} · {o.semesterName} · Section {o.sectionName}</span>
                        <span className="mt-1 block text-muted-foreground">{o.facultyName ? `Current Faculty: ${o.facultyName}` : "Current Faculty: Unassigned"}</span>
                      </span>
                    </label>
                  );
                }) : <div className="p-4 text-xs text-muted-foreground">{selectedProgram && selectedYearLevel && selectedSemester ? "No subject offerings match the selected filters." : "Select Program, Year Level, and Semester to view valid offerings."}</div>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModal(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={selectedCount === 0}>Assign Subjects ({selectedCount})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignModal} onOpenChange={setReassignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Subject Offering</DialogTitle>
            <DialogDescription>
              Reassign {reassignOffering?.subjectCode} to a different faculty member
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label>New Faculty</Label>
              <Select value={newFacultyId} onValueChange={setNewFacultyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select faculty..." />
                </SelectTrigger>
                <SelectContent>
                  {faculty.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.firstName} {f.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={!newFacultyId}>
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}