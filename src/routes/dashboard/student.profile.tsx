import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { GraduationCap, Pencil, Save, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import {
  ApiRequestError,
  fetchStudentById,
  updateMyStudentProfile,
  type StudentProfileUpdate,
  type StudentRegistration,
} from "@/lib/api";

export const Route = createFileRoute("/dashboard/student/profile")({
  component: StudentProfilePage,
});

type EditableField = keyof StudentProfileUpdate;
type ProfileForm = Record<EditableField, string>;
type ProfileInputType = "text" | "email" | "date" | "tel";

const profileSections: {
  title: string;
  fields: { key: EditableField; label: string; type?: ProfileInputType; required?: boolean }[];
}[] = [
  {
    title: "Personal Information",
    fields: [
      { key: "firstName", label: "First Name", required: true },
      { key: "middleName", label: "Middle Name" },
      { key: "lastName", label: "Last Name", required: true },
      { key: "suffix", label: "Suffix" },
      { key: "gender", label: "Gender" },
      { key: "dob", label: "Date of Birth", type: "date" },
      { key: "civilStatus", label: "Civil Status" },
      { key: "nationality", label: "Nationality" },
      { key: "religion", label: "Religion" },
      { key: "placeOfBirth", label: "Place of Birth" },
    ],
  },
  {
    title: "Contact Information",
    fields: [
      { key: "email", label: "Email Address", type: "email", required: true },
      { key: "contactNumber", label: "Contact Number", type: "tel" },
      { key: "address", label: "House Number / Street" },
      { key: "barangay", label: "Barangay" },
      { key: "city", label: "City / Municipality" },
      { key: "province", label: "Province" },
      { key: "region", label: "Region" },
      { key: "zip", label: "ZIP Code" },
    ],
  },
  {
    title: "Family Information",
    fields: [
      { key: "fatherName", label: "Father's Name" },
      { key: "fatherOccupation", label: "Father's Occupation" },
      { key: "fatherContact", label: "Father's Contact Number", type: "tel" },
      { key: "motherName", label: "Mother's Name" },
      { key: "motherOccupation", label: "Mother's Occupation" },
      { key: "motherContact", label: "Mother's Contact Number", type: "tel" },
      { key: "guardianName", label: "Guardian's Name" },
      { key: "guardianOccupation", label: "Guardian's Occupation" },
      { key: "guardianContact", label: "Guardian's Contact Number", type: "tel" },
      { key: "guardianRelation", label: "Guardian Relationship" },
    ],
  },
];

const editableFields = profileSections.flatMap((section) =>
  section.fields.map((field) => field.key),
);

function toProfileForm(student: StudentRegistration): ProfileForm {
  return Object.fromEntries(
    editableFields.map((field) => [field, String(student[field] ?? "")]),
  ) as ProfileForm;
}

function StudentProfilePage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentRegistration | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    if (!user?.studentId) {
      setLoading(false);
      return;
    }

    fetchStudentById(user.studentId)
      .then((profile) => {
        if (!active) return;
        setStudent(profile);
        setForm(toProfileForm(profile));
      })
      .catch((error: unknown) => {
        if (active)
          toast.error(error instanceof Error ? error.message : "Unable to load your profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.studentId]);

  const handleCancel = () => {
    if (student) setForm(toProfileForm(student));
    setErrors({});
    setEditing(false);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setErrors({});
    setSaving(true);
    try {
      const updated = await updateMyStudentProfile(form);
      setStudent(updated);
      setForm(toProfileForm(updated));
      setEditing(false);
      toast.success("Your personal information was updated.");
    } catch (error: unknown) {
      if (error instanceof ApiRequestError && error.details) {
        setErrors(error.details);
      }
      toast.error(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const academicFields = [
    { label: "Student ID", value: student?.studentId },
    { label: "Program / Course", value: student?.program },
    { label: "Year Level", value: student?.yearLevel },
    { label: "Section", value: student?.section },
    { label: "Academic Year", value: student?.academicYear },
    { label: "Semester", value: student?.semester },
    { label: "Enrollment Status", value: student?.enrollmentStatus },
    { label: "Registration Status", value: student?.status },
  ];

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading your profile...</p>;
  }

  if (!student || !form) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <h1 className="font-heading text-xl font-bold text-foreground">Student Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your student profile could not be loaded. Please sign in with your student account and try
          again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Student Profile</h1>
          <p className="text-sm text-muted-foreground">
            View your profile and update personal details.
          </p>
        </div>
        {!editing && (
          <Button onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            Edit Personal Information
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserRound className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {[student.firstName, student.middleName, student.lastName, student.suffix]
              .filter(Boolean)
              .join(" ")}
          </h2>
          <p className="text-sm text-muted-foreground">{student.studentId}</p>
        </div>
      </div>

      <form onSubmit={handleSave} noValidate>
        <div className="space-y-6">
          {profileSections.map((section) => (
            <section key={section.title} className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-4 font-heading text-sm font-semibold text-card-foreground">
                {section.title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`profile-${field.key}`}>
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {editing && field.key === "gender" ? (
                      <select
                        id={`profile-${field.key}`}
                        value={form[field.key]}
                        onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                        aria-invalid={Boolean(errors[field.key])}
                        aria-describedby={errors[field.key] ? `error-${field.key}` : undefined}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : editing ? (
                      <Input
                        id={`profile-${field.key}`}
                        type={field.type ?? "text"}
                        value={form[field.key]}
                        required={field.required}
                        maxLength={field.key === "email" ? 254 : undefined}
                        inputMode={field.type === "tel" ? "tel" : undefined}
                        aria-invalid={Boolean(errors[field.key])}
                        aria-describedby={errors[field.key] ? `error-${field.key}` : undefined}
                        onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                      />
                    ) : (
                      <p className="min-h-9 rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
                        {form[field.key] || "—"}
                      </p>
                    )}
                    {editing && errors[field.key] && (
                      <p
                        id={`error-${field.key}`}
                        role="alert"
                        className="text-xs text-destructive"
                      >
                        {errors[field.key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="font-heading text-sm font-semibold text-card-foreground">
                Academic Information (Read-only)
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {academicFields.map((field) => (
                <div key={field.label}>
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  <p className="mt-1 rounded-md bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                    {field.value || "Not assigned"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Program, course, section, academic placement, assigned subjects, faculty assignments,
              grades, and attendance are managed by authorized staff and cannot be changed here.
            </p>
          </section>

          {editing && (
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                <X aria-hidden="true" />
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Save aria-hidden="true" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
