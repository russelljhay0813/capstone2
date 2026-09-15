import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BookOpen,
  GraduationCap,
  Landmark,
  Menu,
  ShieldCheck,
  Sparkles,
  ClipboardList,
  School,
  Users,
  FileText,
  BellRing,
  Phone,
  Mail,
  Clock3,
  ArrowRight,
  ChevronRight,
  CircleCheckBig,
  BadgeCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchAnnouncements,
  fetchProgramsDetailed,
  type Announcement,
  type Program,
} from "@/lib/api";

const navigationItems = [
  { label: "Home", href: "#home" },
  { label: "About PIAT", href: "#about" },
  { label: "Academic Programs", href: "#programs" },
  { label: "Admission", href: "#admission" },
  { label: "Contact", href: "#contact" },
];

const aboutCards = [
  {
    title: "History",
    icon: Landmark,
    body: "PIAT was established to provide industry-aligned education that equips learners with practical knowledge, professional discipline, and strong academic foundations.",
  },
  {
    title: "Mission",
    icon: BadgeCheck,
    body: "To deliver quality and accessible education that nurtures skilled, ethical, and globally competitive professionals.",
  },
  {
    title: "Vision",
    icon: Sparkles,
    body: "To become a leading institution recognized for excellence in technology, arts, and professional education.",
  },
  {
    title: "Core Values",
    icon: ShieldCheck,
    body: "Excellence, integrity, service, innovation, and commitment to lifelong learning guide every PIAT learning experience.",
  },
];

const admissionSteps = [
  "Administrator creates the student account.",
  "Student receives login credentials.",
  "Student logs in and completes the registration form.",
  "The system automatically approves the registration.",
  "Student is officially enrolled.",
  "Student accesses the Student Dashboard.",
];

const featureGroups = [
  {
    title: "Administrator",
    icon: School,
    items: [
      {
        name: "User Management",
        description: "Maintain and monitor institutional accounts with ease.",
      },
      {
        name: "Program Management",
        description: "Create and update academic programs and offerings.",
      },
      {
        name: "System Monitoring",
        description: "Track activity and maintain operational oversight.",
      },
    ],
  },
  {
    title: "Registrar",
    icon: ClipboardList,
    items: [
      {
        name: "Registration Monitoring",
        description: "Monitor and verify student registration records.",
      },
      { name: "Enrollment", description: "Coordinate and confirm student enrollment workflows." },
      {
        name: "Subject Offerings",
        description: "Manage available subjects and effective scheduling.",
      },
      {
        name: "Faculty Assignment",
        description: "Align instructors to their teaching responsibilities.",
      },
      { name: "Academic Records", description: "Keep records accurate, accessible, and current." },
    ],
  },
  {
    title: "Faculty",
    icon: Users,
    items: [
      { name: "Assigned Subjects", description: "View courses assigned to each instructor." },
      {
        name: "Student Class Lists",
        description: "Track and manage classes under each faculty member.",
      },
      { name: "Grade Encoding", description: "Enter and review learner performance efficiently." },
      {
        name: "Attendance Management",
        description: "Monitor attendance and maintain class records.",
      },
    ],
  },
  {
    title: "Student",
    icon: FileText,
    items: [
      { name: "Registration", description: "Complete your registration form online." },
      { name: "Enrollment Status", description: "Check your verified enrollment progress." },
      { name: "Subject Schedule", description: "Review your class calendar and timetable." },
      { name: "Grades", description: "Access academic performance updates promptly." },
      { name: "Academic Records", description: "View transcripts, history, and records." },
      { name: "Re-enrollment", description: "Manage re-enrollment for upcoming terms." },
    ],
  },
];

const whyChooseItems = [
  "Centralized Academic Management",
  "Secure User Authentication",
  "Real-Time Student Records",
  "Integrated Faculty and Registrar Modules",
  "Responsive Design",
  "Easy-to-Use Interface",
];

function formatDate(timestamp: number | string | undefined) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [programsData, setProgramsData] = useState<Program[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [selectedCurriculum, setSelectedCurriculum] = useState<any[]>([]);
  const [formState, setFormState] = useState({ fullName: "", email: "", subject: "", message: "" });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [programsResult, announcementsResult] = await Promise.all([
          fetchProgramsDetailed(),
          fetchAnnouncements(),
        ]);
        if (mounted) {
          setProgramsData(programsResult.filter((program) => program.status === "active"));
          setAnnouncements(announcementsResult.slice(0, 4));
        }
      } catch {
        if (mounted) {
          setProgramsData([]);
          setAnnouncements([]);
        }
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formState.fullName.trim()) errors.fullName = "Full name is required.";
    if (!formState.email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email))
      errors.email = "Enter a valid email address.";
    if (!formState.subject.trim()) errors.subject = "Subject is required.";
    if (!formState.message.trim()) errors.message = "Message is required.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;
    setFormSubmitted(true);
    setFormState({ fullName: "", email: "", subject: "", message: "" });
  };

  const openCurriculum = async (program: Program) => {
    setSelectedProgram(program);
    try {
      const curriculum = await fetch(
        `/api/curriculum?program=${encodeURIComponent(program.name)}`,
      ).then((response) => response.json());
      setSelectedCurriculum(curriculum.slice(0, 12));
    } catch {
      setSelectedCurriculum([]);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="#home" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              PIAT
            </div>
            <div>
              <p className="font-heading text-sm font-semibold">PIAT</p>
              <p className="text-xs text-muted-foreground">Academic Management System</p>
            </div>
          </a>
          <nav className="hidden items-center gap-6 lg:flex">
            {navigationItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-foreground/80 transition hover:text-primary"
              >
                {item.label}
              </a>
            ))}
            <button
              onClick={() => navigate({ to: "/login" })}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Login
            </button>
          </nav>
          <button
            className="rounded-full border border-border p-2 lg:hidden"
            onClick={() => setIsMenuOpen((value) => !value)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        {isMenuOpen && (
          <div className="border-t border-border bg-background/95 px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-3">
              {navigationItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm font-medium text-foreground/80"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <button
                onClick={() => navigate({ to: "/login" })}
                className="w-fit rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Login
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="home">
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(122,20,20,0.14),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(250,245,240,0.9))] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-3 py-1.5 text-sm font-medium text-primary shadow-sm">
                <GraduationCap className="h-4 w-4" />
                Official Academic Platform
              </div>
              <h1 className="max-w-2xl font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                PIAT Academic Management System
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                Welcome to the PIAT Academic Management System, a centralized platform designed to
                streamline student registration, enrollment, academic records, faculty management,
                and administrative services.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate({ to: "/login" })}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-px hover:opacity-90"
                >
                  Login <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#about"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                >
                  Learn More <ChevronRight className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CircleCheckBig className="h-4 w-4 text-primary" /> Live academic workflows
                </div>
                <div className="flex items-center gap-2">
                  <CircleCheckBig className="h-4 w-4 text-primary" /> Secure role-based access
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="rounded-[2rem] border border-border/80 bg-white/80 p-6 shadow-2xl shadow-primary/10 backdrop-blur"
            >
              <div className="rounded-[1.5rem] bg-linear-to-br from-primary to-[#8b1f1f] p-8 text-primary-foreground">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary-foreground/80">
                      Institution Overview
                    </p>
                    <h2 className="mt-2 font-heading text-2xl font-semibold">
                      Professional Academic Operations
                    </h2>
                  </div>
                  <div className="rounded-full bg-white/15 p-3">
                    <BookOpen className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-8 space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">
                    Academic Programs
                  </p>
                  {programsData.length > 0 ? (
                    programsData.slice(0, 5).map((program) => (
                      <div key={program.id} className="rounded-2xl bg-white/10 p-4">
                        <p className="font-semibold">{program.name}</p>
                        {program.description && (
                          <p className="mt-1 text-sm text-primary-foreground/75">
                            {program.description}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl bg-white/10 p-4 text-sm text-primary-foreground/80">
                      No academic programs are currently available.
                    </p>
                  )}
                </div>
                <div className="mt-8 rounded-2xl border border-white/15 bg-black/10 p-4">
                  <p className="text-sm text-primary-foreground/80">
                    Academic programs are loaded from the PIAT database and reflect the programs
                    currently offered by the institution.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="about" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                About PIAT
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
                A trusted institution for modern technical and creative education.
              </h2>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {aboutCards.map((card) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.title}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className="rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:shadow-lg"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 font-heading text-xl font-semibold">{card.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.body}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="programs" className="bg-muted/40 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  Academic Programs
                </p>
                <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
                  Programs designed for industry-ready learning.
                </h2>
              </div>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {programsData.length > 0 ? (
                programsData.map((item) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className="rounded-3xl border border-border bg-card p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <GraduationCap className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="mt-6 font-heading text-xl font-semibold">{item.name}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {item.description ||
                        "A comprehensive program designed to support academic excellence and practical skill development."}
                    </p>
                    <button
                      onClick={() => openCurriculum(item)}
                      className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:gap-3"
                    >
                      View Curriculum <ArrowRight className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="rounded-3xl border border-border bg-card p-8 text-muted-foreground shadow-sm">
                  No academic programs are currently available.
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="admission" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Admission Process
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
                A simple and guided enrollment journey.
              </h2>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
                <ol className="space-y-5">
                  {admissionSteps.map((step, index) => (
                    <li key={step} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{step}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          A streamlined step for every applicant and enrolled learner.
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-3xl border border-border bg-linear-to-br from-primary/95 to-[#8b1f1f] p-8 text-primary-foreground shadow-lg">
                <h3 className="font-heading text-2xl font-semibold">Start Your Academic Journey</h3>
                <p className="mt-4 text-sm leading-7 text-primary-foreground/85">
                  From the first account creation to the student dashboard, PIAT’s admission
                  workflow is designed to be transparent and efficient for both applicants and
                  staff.
                </p>
                <div className="mt-8 space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                    <ShieldCheck className="h-5 w-5" />
                    <span>Secure account setup for every new learner</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                    <ClipboardList className="h-5 w-5" />
                    <span>Registrar-driven review for smooth approval</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                    <BookOpen className="h-5 w-5" />
                    <span>Immediate access to the student dashboard after enrollment</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-muted/40 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                System Features
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
                A complete digital ecosystem for every role.
              </h2>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {featureGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <div
                    key={group.title}
                    className="rounded-3xl border border-border bg-card p-6 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-xl font-semibold">{group.title}</h3>
                    </div>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      {group.items.map((item) => (
                        <div
                          key={item.name}
                          className="rounded-2xl border border-border/70 bg-background/70 p-4"
                        >
                          <h4 className="font-semibold text-foreground">{item.name}</h4>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Why Choose PIAT
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
                Built for clarity, efficiency, and institutional growth.
              </h2>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {whyChooseItems.map((item) => (
                <div key={item} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CircleCheckBig className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-heading text-lg font-semibold">{item}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted/40 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Announcements
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
                Stay informed with the latest updates.
              </h2>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {announcements.length > 0 ? (
                announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="rounded-3xl border border-border bg-card p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        {announcement.category || "General"}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(announcement.createdAt || announcement.datePosted)}
                      </span>
                    </div>
                    <h3 className="mt-5 font-heading text-xl font-semibold">
                      {announcement.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {announcement.body}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-border bg-card p-8 text-muted-foreground shadow-sm">
                  No announcements available.
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="contact" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Contact
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
                Get in touch with PIAT.
              </h2>
              <div className="mt-8 space-y-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Landmark className="mt-0.5 h-5 w-5 text-primary" />{" "}
                  <div>
                    <p className="font-semibold text-foreground">PIAT</p>
                    <p>Philtech Institute of Arts and Technology</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 text-primary" />{" "}
                  <div>
                    <p className="font-semibold text-foreground">Contact Number</p>
                    <p>+63 2 1234 5678</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-primary" />{" "}
                  <div>
                    <p className="font-semibold text-foreground">Email Address</p>
                    <p>info@piat.edu.ph</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-5 w-5 text-primary" />{" "}
                  <div>
                    <p className="font-semibold text-foreground">Office Hours</p>
                    <p>Monday to Friday • 8:00 AM to 5:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
              <h3 className="font-heading text-2xl font-semibold text-foreground">
                Send Us a Message
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                This form is ready for future backend integration. For now it validates your input
                and confirms submission.
              </p>
              <form onSubmit={handleFormSubmit} className="mt-8 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-medium text-foreground"
                      htmlFor="contact-name"
                    >
                      Full Name
                    </label>
                    <input
                      id="contact-name"
                      value={formState.fullName}
                      onChange={(event) =>
                        setFormState((value) => ({ ...value, fullName: event.target.value }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    {formErrors.fullName && (
                      <p className="mt-1 text-sm text-destructive">{formErrors.fullName}</p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-medium text-foreground"
                      htmlFor="contact-email"
                    >
                      Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={formState.email}
                      onChange={(event) =>
                        setFormState((value) => ({ ...value, email: event.target.value }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-destructive">{formErrors.email}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium text-foreground"
                    htmlFor="contact-subject"
                  >
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    value={formState.subject}
                    onChange={(event) =>
                      setFormState((value) => ({ ...value, subject: event.target.value }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {formErrors.subject && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.subject}</p>
                  )}
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium text-foreground"
                    htmlFor="contact-message"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    value={formState.message}
                    onChange={(event) =>
                      setFormState((value) => ({ ...value, message: event.target.value }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {formErrors.message && (
                    <p className="mt-1 text-sm text-destructive">{formErrors.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Send Message <ArrowRight className="h-4 w-4" />
                </button>
                {formSubmitted && (
                  <p className="text-sm font-medium text-success">
                    Thank you. Your inquiry has been prepared for review.
                  </p>
                )}
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/80 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.6fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                PIAT
              </div>
              <div>
                <p className="font-heading text-lg font-semibold">
                  PIAT Academic Management System
                </p>
                <p className="text-sm text-muted-foreground">
                  A modern academic platform for students, faculty, and administration.
                </p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold">Quick Links</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#home" className="transition hover:text-primary">
                  Home
                </a>
              </li>
              <li>
                <a href="#about" className="transition hover:text-primary">
                  About PIAT
                </a>
              </li>
              <li>
                <a href="#programs" className="transition hover:text-primary">
                  Academic Programs
                </a>
              </li>
              <li>
                <a href="#contact" className="transition hover:text-primary">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold">Contact Information</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>info@piat.edu.ph</li>
              <li>+63 2 1234 5678</li>
              <li>Monday to Friday • 8:00 AM to 5:00 PM</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 PIAT Academic Management System. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a
              href="mailto:info@piat.edu.ph"
              className="transition hover:text-primary"
              aria-label="Email PIAT"
            >
              <BellRing className="h-4 w-4" />
            </a>
            <a
              href="mailto:info@piat.edu.ph"
              className="transition hover:text-primary"
              aria-label="Email PIAT"
            >
              <Mail className="h-4 w-4" />
            </a>
            <a
              href="tel:+63212345678"
              className="transition hover:text-primary"
              aria-label="Call PIAT"
            >
              <Phone className="h-4 w-4" />
            </a>
          </div>
        </div>
      </footer>

      <Dialog
        open={Boolean(selectedProgram)}
        onOpenChange={(open) => !open && setSelectedProgram(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedProgram?.name ?? "Program Curriculum"}</DialogTitle>
            <DialogDescription>
              Overview of the selected academic program, year levels, and semesters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Program Overview</p>
              <p className="mt-2 text-sm leading-7 text-foreground">
                {selectedProgram?.description ||
                  "This program offers a comprehensive curriculum aligned with the institution’s educational standards."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Year Levels</p>
                <p className="mt-2 text-sm text-muted-foreground">1st Year through 4th Year</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Semesters</p>
                <p className="mt-2 text-sm text-muted-foreground">1st Semester and 2nd Semester</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Curriculum Preview</p>
              <div className="mt-3 space-y-2">
                {selectedCurriculum.length > 0 ? (
                  selectedCurriculum.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm"
                    >
                      <span className="text-foreground">
                        {item.subjectCode} — {item.subjectTitle}
                      </span>
                      <span className="text-muted-foreground">
                        {item.yearLevel} • {item.semester}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Curriculum details will be available for this program.
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
