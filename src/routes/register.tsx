import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  GraduationCap,
  CheckCircle2,
  ArrowLeft,
  User,
  Phone,
  BookOpen,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { emailExists, submitRegistration } from "@/lib/registrations-store";
import { fetchAcademicStructure, fetchPrograms, type StudentRegistration } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { YEAR_LEVELS, SEMESTERS } from "@/lib/subjects-store";
import { fetchBarangays, fetchCities, fetchProvinces, fetchRegions, type LocationOption } from "@/lib/locations";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Student Registration — PIAT" },
      {
        name: "description",
        content:
          "Apply for admission to Philtech Institute Of Arts And Technology. Submit your registration for automatic approval and enrollment.",
      },
    ],
  }),
  component: RegisterPage,
});

const GENDERS = ["Male", "Female", "Prefer not to say"];
const CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated"];

const step1Schema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  middleName: z.string().optional(),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  suffix: z.string().optional(),
  gender: z.string().min(1, "Gender is required"),
  dob: z.string().min(1, "Date of birth is required"),
  civilStatus: z.string().min(1, "Civil status is required"),
  nationality: z.string().trim().min(1, "Nationality is required"),
  placeOfBirth: z.string().optional(),
});

const step2Schema = z.object({
  email: z.string().trim().email("Invalid email"),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{10,15}$/, "Valid mobile number is required"),
  homeAddress: z.string().trim().min(1, "Home address is required"),
  region: z.string().trim().min(1, "Region is required"),
  province: z.string().trim().min(1, "Province is required"),
  city: z.string().trim().min(1, "Municipality/City is required"),
  barangay: z.string().trim().min(1, "Barangay is required"),
  zipCode: z.string().trim().min(1, "ZIP code is required"),
  parentGuardianName: z.string().trim().min(1, "Parent/Guardian name is required"),
  relationship: z.string().trim().min(1, "Relationship is required"),
  parentGuardianContact: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{10,15}$/, "Valid contact number is required"),
});

const step3Schema = z.object({
  program: z.string().min(1, "Program is required"),
  yearLevel: z.string().min(1, "Year level is required"),
  semester: z.string().min(1, "Semester is required"),
  academicYear: z.string().min(1, "Academic year is required"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

type FormState = Step1Data & Step2Data & Step3Data;

function RegisterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string>("");
  const [programs, setPrograms] = useState<string[]>([]);
  const [academicStructure, setAcademicStructure] = useState({
    academicYears: [] as string[],
    yearLevels: [] as string[],
    semesters: [] as string[],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [studentRecord, setStudentRecord] = useState<StudentRegistration | null>(null);
  const currentYear = new Date().getFullYear();
  const [previewData, setPreviewData] = useState<FormState | null>(null);
  const [regions, setRegions] = useState<LocationOption[]>([]);
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [cities, setCities] = useState<LocationOption[]>([]);
  const [barangays, setBarangays] = useState<LocationOption[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState("");

  const form = useForm<FormState>({
    resolver: zodResolver(step1Schema.merge(step2Schema).merge(step3Schema)),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      suffix: "",
      gender: "",
      dob: "",
      civilStatus: "",
      nationality: "Filipino",
      placeOfBirth: "",
      email: "",
      mobileNumber: "",
      homeAddress: "",
      region: "",
      province: "",
      city: "",
      barangay: "",
      zipCode: "",
      parentGuardianName: "",
      relationship: "Father",
      parentGuardianContact: "",
      // Academic fields are not stored on student, but we pre-fill from user context if available (from previous login)
      program: user?.program || "",
      yearLevel: user?.yearLevel || YEAR_LEVELS[0],
      semester: user?.semester || SEMESTERS[0],
      academicYear: user?.academicYear || `${currentYear}-${currentYear + 1}`,
    },
  });

  // Fetch the student's existing record if they already have one
  useEffect(() => {
    if (user?.studentId) {
      fetch(`/api/students/${encodeURIComponent(user.studentId)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((record) => {
          if (record) {
            setStudentRecord(record);
            const normalizedStatus = String(record.status || "").toLowerCase();
            setSubmitted(
              normalizedStatus === "submitted" ||
                normalizedStatus === "under_review" ||
                normalizedStatus === "approved",
            );
            if (normalizedStatus === "approved") {
              navigate({ to: "/dashboard/student" });
              return;
            }
            // Pre-fill personal and contact fields from the existing record
            form.reset({
              firstName: record.firstName || "",
              middleName: record.middleName || "",
              lastName: record.lastName || "",
              suffix: record.suffix || "",
              gender: record.gender || "",
              dob: record.dob || "",
              civilStatus: record.civilStatus || "",
              nationality: record.nationality || "Filipino",
              placeOfBirth: record.placeOfBirth || "",
              email: record.email || "",
              mobileNumber: record.contactNumber || "",
              homeAddress: record.address || "",
              region: record.region || "",
              province: record.province || "",
              city: record.city || "",
              barangay: record.barangay || "",
              zipCode: record.zip || "",
              parentGuardianName: record.parentName || "",
              relationship: record.parentRelationship || "Father",
              parentGuardianContact: record.parentContact || "",
              // Academic fields are not stored on student, so we keep the current form values
              // (they may have been pre-filled from user context)
              program: form.getValues("program"),
              yearLevel: form.getValues("yearLevel"),
              semester: form.getValues("semester"),
              academicYear: form.getValues("academicYear"),
            });
          }
        })
        .catch(() => undefined);
    }
  }, [user?.studentId]);

  useEffect(() => {
    Promise.all([fetchPrograms(), fetchAcademicStructure()])
      .then(([programData, structureData]) => {
        setPrograms(programData);
        setAcademicStructure(structureData);
      })
      .catch(() => {
        setPrograms([]);
        setAcademicStructure({ academicYears: [], yearLevels: [], semesters: [] });
      });
  }, []);

    const selectedRegion = form.watch("region");
    const selectedProvince = form.watch("province");
    const selectedCity = form.watch("city");

    useEffect(() => {
      fetchRegions().then(setRegions).catch(() => setRegions([]));
    }, []);

    useEffect(() => {
      const option = regions.find((entry) => entry.name === selectedRegion);
      setRegionCode(option?.code || "");
      setProvinces([]);
      setProvinceCode("");
      setCities([]);
      setCityCode("");
      setBarangays([]);
      if (option) fetchProvinces(option.code).then(setProvinces).catch(() => setProvinces([]));
    }, [regions, selectedRegion]);

    useEffect(() => {
      const option = provinces.find((entry) => entry.name === selectedProvince);
      setProvinceCode(option?.code || "");
      setCities([]);
      setCityCode("");
      setBarangays([]);
      if (option) fetchCities(option.code).then(setCities).catch(() => setCities([]));
    }, [provinces, selectedProvince]);

    useEffect(() => {
      const option = cities.find((entry) => entry.name === selectedCity);
      setCityCode(option?.code || "");
      setBarangays([]);
      if (option) fetchBarangays(option.code).then(setBarangays).catch(() => setBarangays([]));
    }, [cities, selectedCity]);

  const watchAll = form.watch();

  useEffect(() => {
    if (step === 4 && previewData) {
      setPreviewData({ ...watchAll });
    }
  }, [step, watchAll]);

  const validateStep = async (currentStep: number) => {
    let isValid = false;
    switch (currentStep) {
      case 1:
        isValid = await form.trigger([
          "firstName",
          "lastName",
          "gender",
          "dob",
          "civilStatus",
          "nationality",
        ]);
        break;
      case 2:
        isValid = await form.trigger([
          "email",
          "mobileNumber",
          "homeAddress",
          "region",
          "province",
          "city",
          "barangay",
          "zipCode",
          "parentGuardianName",
          "relationship",
          "parentGuardianContact",
        ]);
        if (isValid) {
          const email = form.getValues("email");
          if (
            studentRecord?.email &&
            studentRecord.email !== email &&
            (await emailExists(email || ""))
          ) {
            form.setError("email", { message: "This email is already registered" });
            isValid = false;
          }
        }
        break;
      case 3:
        isValid = await form.trigger(["program", "yearLevel", "semester", "academicYear"]);
        break;
    }
    return isValid;
  };

  const nextStep = async () => {
    const isValid = await validateStep(step);
    if (isValid) {
      if (step === 3) {
        setPreviewData(form.getValues());
      }
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    const data = form.getValues();
    if (!user?.studentId) {
      form.setError("email", {
        message: "Your student account could not be identified. Please sign in again.",
      });
      return;
    }

    if (
      studentRecord?.email &&
      studentRecord.email !== data.email &&
      (await emailExists(data.email || ""))
    ) {
      form.setError("email", { message: "This email is already registered" });
      return;
    }

    setIsLoading(true);
    try {
      // Build payload: personal and contact fields, plus academic info for enrollment
      const payload = {
        studentId: user.studentId,
        firstName: data.firstName,
        middleName: data.middleName || undefined,
        lastName: data.lastName,
        suffix: data.suffix || undefined,
        email: data.email,
        // We don't have password here, but we keep the existing one
        // password will be kept from the student record or user context
        password: studentRecord?.password || "",
        educationLevel: "College" as const,
        gender: data.gender || undefined,
        dob: data.dob || undefined,
        civilStatus: data.civilStatus || undefined,
        nationality: data.nationality,
        contactNumber: data.mobileNumber || undefined,
        address: data.homeAddress,
        region: data.region || undefined,
        province: data.province || undefined,
        city: data.city || undefined,
        barangay: data.barangay || undefined,
        zip: data.zipCode || undefined,
        parentName: data.parentGuardianName || undefined,
        parentContact: data.parentGuardianContact || undefined,
        parentRelationship: data.relationship || undefined,
        placeOfBirth: data.placeOfBirth || undefined,
        // Academic fields for auto-enrollment (these are not stored on student)
        program: data.program,
        yearLevel: data.yearLevel,
        semester: data.semester,
        academicYear: data.academicYear,
        status: "submitted",
      };

      const created = await submitRegistration(payload);
      const actualStatus = created?.status || "pending";
      if (actualStatus === "approved") {
        setSubmissionMessage(
          "Registration completed successfully. Your registration has been approved and you are now officially enrolled.",
        );
      } else {
        setSubmissionMessage(
          "Registration submitted successfully. Your application is under review by the Registrar's Office.",
        );
      }
      if (actualStatus === "approved") {
        navigate({ to: "/dashboard/student" });
        return;
      }
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted || ["submitted", "under_review"].includes(String(studentRecord?.status || ""))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            Registration Submitted Successfully
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {submissionMessage ||
              "Registration completed successfully. Your application is under review by the Registrar's Office."}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  const stepTitles = [
    { step: 1, title: "Personal Information", icon: User },
    { step: 2, title: "Contact Information", icon: Phone },
    { step: 3, title: "Academic Information", icon: BookOpen },
    { step: 4, title: "Review Information", icon: CheckCircle2 },
  ];

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Student Registration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete all steps to submit your registration. Your account will be approved
            automatically and enrollment will be created immediately.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-6 flex items-center justify-center">
          <div className="flex items-center gap-2">
            {stepTitles.map((s, i) => (
              <div key={s.step} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${step >= s.step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {s.step}
                </div>
                {i < stepTitles.length - 1 && (
                  <div className={`h-0.5 w-12 ${step > s.step ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <form className="space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="rounded-2xl border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2 border-b pb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {step === 1 && <User className="h-4 w-4" />}
                  {step === 2 && <Phone className="h-4 w-4" />}
                  {step === 3 && <BookOpen className="h-4 w-4" />}
                  {step === 4 && <CheckCircle2 className="h-4 w-4" />}
                </span>
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">
                  {stepTitles[step - 1].title}
                </h2>
              </div>

              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="First Name *" error={form.formState.errors.firstName?.message}>
                    <input {...form.register("firstName")} className="input" />
                  </Field>
                  <Field label="Middle Name">
                    <input {...form.register("middleName")} className="input" />
                  </Field>
                  <Field label="Last Name *" error={form.formState.errors.lastName?.message}>
                    <input {...form.register("lastName")} className="input" />
                  </Field>
                  <Field label="Suffix">
                    <input
                      {...form.register("suffix")}
                      className="input"
                      placeholder="Jr, III, etc."
                    />
                  </Field>
                  <Field label="Gender">
                    <select {...form.register("gender")} className="input">
                      <option value="">Select...</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date of Birth">
                    <input type="date" {...form.register("dob")} className="input" />
                  </Field>
                  <Field label="Civil Status">
                    <select {...form.register("civilStatus")} className="input">
                      {CIVIL_STATUS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nationality *" error={form.formState.errors.nationality?.message}>
                    <input {...form.register("nationality")} className="input" />
                  </Field>
                  <Field label="Place of Birth" className="sm:col-span-2 lg:col-span-3">
                    <input {...form.register("placeOfBirth")} className="input" />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Email Address *" error={form.formState.errors.email?.message}>
                    <input type="email" {...form.register("email")} className="input" />
                  </Field>
                  <Field
                    label="Mobile Number *"
                    error={form.formState.errors.mobileNumber?.message}
                  >
                    <input {...form.register("mobileNumber")} className="input" />
                  </Field>
                  <Field
                    label="Home Address *"
                    error={form.formState.errors.homeAddress?.message}
                    className="sm:col-span-2 lg:col-span-3"
                  >
                    <input {...form.register("homeAddress")} className="input" />
                  </Field>
                  <Field label="Region *" error={form.formState.errors.region?.message}>
                    <select
                      {...form.register("region", {
                        onChange: () => {
                          form.setValue("province", "", { shouldValidate: true });
                          form.setValue("city", "", { shouldValidate: true });
                          form.setValue("barangay", "", { shouldValidate: true });
                        },
                      })}
                      className="input"
                    >
                      <option value="">Select region...</option>
                      {regions.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Province *" error={form.formState.errors.province?.message}>
                    <select
                      {...form.register("province", {
                        onChange: () => {
                          form.setValue("city", "", { shouldValidate: true });
                          form.setValue("barangay", "", { shouldValidate: true });
                        },
                      })}
                      className="input"
                      disabled={!regionCode}
                    >
                      <option value="">Select province...</option>
                      {provinces.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
                    </select>
                  </Field>
                  <Field label="City/Municipality *" error={form.formState.errors.city?.message}>
                    <select {...form.register("city")} className="input" disabled={!provinceCode}>
                      <option value="">Select city/municipality...</option>
                      {cities.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Barangay *" error={form.formState.errors.barangay?.message}>
                    <select {...form.register("barangay")} className="input" disabled={!cityCode}>
                      <option value="">Select barangay...</option>
                      {barangays.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
                    </select>
                  </Field>
                  <Field label="ZIP Code">
                    <input {...form.register("zipCode")} className="input" />
                  </Field>
                  <Field
                    label="Parent/Guardian Name *"
                    error={form.formState.errors.parentGuardianName?.message}
                  >
                    <input {...form.register("parentGuardianName")} className="input" />
                  </Field>
                  <Field label="Relationship *" error={form.formState.errors.relationship?.message}>
                    <select {...form.register("relationship")} className="input">
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                    </select>
                  </Field>
                  <Field label="Parent/Guardian Contact *" error={form.formState.errors.parentGuardianContact?.message}>
                    <input {...form.register("parentGuardianContact")} className="input" />
                  </Field>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Program *" error={form.formState.errors.program?.message}>
                    <select {...form.register("program")} className="input">
                      <option value="">Select program...</option>
                      {programs.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Year Level *" error={form.formState.errors.yearLevel?.message}>
                    <select {...form.register("yearLevel")} className="input">
                      {(academicStructure.yearLevels.length ? academicStructure.yearLevels : YEAR_LEVELS).map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Semester *" error={form.formState.errors.semester?.message}>
                    <select {...form.register("semester")} className="input">
                      {(academicStructure.semesters.length ? academicStructure.semesters : SEMESTERS).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Academic Year *" error={form.formState.errors.academicYear?.message}>
                    <select {...form.register("academicYear")} className="input">
                      <option value="">Select academic year...</option>
                      {academicStructure.academicYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              {step === 4 && previewData && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PreviewSection title="Personal Information">
                      <PreviewItem
                        label="Full Name"
                        value={`${previewData.firstName} ${previewData.middleName || ""} ${previewData.lastName} ${previewData.suffix || ""}`}
                      />
                      <PreviewItem label="Gender" value={previewData.gender} />
                      <PreviewItem label="Date of Birth" value={previewData.dob} />
                      <PreviewItem label="Civil Status" value={previewData.civilStatus} />
                      <PreviewItem label="Nationality" value={previewData.nationality} />
                      <PreviewItem label="Place of Birth" value={previewData.placeOfBirth} />
                    </PreviewSection>
                    <PreviewSection title="Contact Information">
                      <PreviewItem label="Email" value={previewData.email} />
                      <PreviewItem label="Mobile" value={previewData.mobileNumber} />
                      <PreviewItem label="Address" value={previewData.homeAddress} />
                      <PreviewItem label="Parent/Guardian" value={previewData.parentGuardianName} />
                      <PreviewItem label="Relationship" value={previewData.relationship} />
                      <PreviewItem
                        label="Parent Contact"
                        value={previewData.parentGuardianContact}
                      />
                    </PreviewSection>
                  </div>
                  <PreviewSection title="Academic Information">
                    <PreviewItem label="Program" value={previewData.program} />
                    <PreviewItem label="Year Level" value={previewData.yearLevel} />
                    <PreviewItem label="Semester" value={previewData.semester} />
                    <PreviewItem label="Academic Year" value={previewData.academicYear} />
                  </PreviewSection>
                  <div className="rounded-lg bg-warning/10 p-4 text-sm text-warning">
                    <p className="font-medium">Important:</p>
                    <p>
                      By submitting this application, you confirm that all information provided is
                      accurate. Your application will be reviewed by the Registrar's Office and you
                      will receive credentials once approved.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to Login
            </Link>
            <div className="flex gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
              )}
              {step < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-lg bg-success px-6 py-2.5 text-sm font-medium text-success-foreground hover:opacity-90"
                >
                  Submit Registration
                </button>
              )}
            </div>
          </div>
        </form>
      </motion.div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:transparent;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;color:hsl(var(--foreground));outline:none}.input:focus{border-color:hsl(var(--accent));box-shadow:0 0 0 2px hsl(var(--accent)/0.2)}`}</style>
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className || ""}`}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <h3 className="font-heading text-xs font-semibold uppercase text-muted-foreground mb-3">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}