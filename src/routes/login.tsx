import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { fetchStudentById, loginUser, loginStudent, type UserAccount } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — PIAT Academic Management System" },
      {
        name: "description",
        content: "Sign in to the PIAT Academic Management System to access your dashboard.",
      },
    ],
  }),
  component: LoginPage,
});

const roleDashboardPaths: Record<UserAccount["role"], string> = {
  admin: "/dashboard/admin",
  faculty: "/dashboard/faculty",
  registrar: "/dashboard/registrar",
  student: "/dashboard/student",
};

function LoginPage() {
  const { loginAs, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (user.role === "student") {
      const registrationStatus = user.registrationStatus?.toLowerCase();
      if (!registrationStatus || registrationStatus !== "approved") {
        navigate({ to: "/register" });
        return;
      }
      navigate({ to: "/dashboard/student" });
      return;
    }

    navigate({ to: roleDashboardPaths[user.role] });
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both your email and password.");
      return;
    }

    setIsLoading(true);

    try {
      let userAccount: UserAccount | null = await loginUser(email, password);
      let studentRecord = null;

      if (!userAccount) {
        studentRecord = await loginStudent(email, password);
        if (studentRecord) {
          userAccount = {
            id: studentRecord.id,
            userId: studentRecord.studentId,
            username: studentRecord.email,
            email: studentRecord.email,
            firstName: studentRecord.firstName,
            lastName: studentRecord.lastName,
            role: "student",
            status: "active",
            studentId: studentRecord.studentId,
            createdAt: studentRecord.submittedAt,
            token: (studentRecord as any).token,
          };
        } else {
          setError("We couldn't find an account with those credentials. Please try again.");
          setIsLoading(false);
          return;
        }
      }

      if (!userAccount) {
        setError("We couldn't find an account with those credentials. Please try again.");
        setIsLoading(false);
        return;
      }

      if (userAccount.role === "student") {
        try {
          if (userAccount.studentId) {
            studentRecord = await fetchStudentById(
              userAccount.studentId,
              (userAccount as any).token,
            );
          } else {
            studentRecord = await loginStudent(email, password);
          }
          if (!(userAccount as any).token && (studentRecord as any)?.token) {
            (userAccount as any).token = (studentRecord as any).token;
          }
        } catch {
          studentRecord = null;
        }
      }

      const ua = userAccount as UserAccount;
      const sessionUser = {
        id: ua.id,
        facultyId: ua.facultyId,
        name: `${ua.firstName} ${ua.lastName}`,
        email: ua.email,
        role: ua.role,
        userId: ua.role === "student" ? (ua.studentId ?? ua.userId ?? studentRecord?.studentId ?? ua.id) : ua.userId,
        token: ua.token ?? (studentRecord as any)?.token,
        studentId: ua.role === "student" ? (ua.studentId ?? studentRecord?.studentId ?? ua.userId ?? undefined) : undefined,
        // In new schema, these are not on student – only keep if they exist (for backward compatibility)
        program: (studentRecord as any)?.program || ua.program,
        yearLevel: (studentRecord as any)?.yearLevel || ua.yearLevel,
        semester: (studentRecord as any)?.semester ?? ua.semester ?? undefined,
        academicYear: (studentRecord as any)?.academicYear ?? ua.academicYear ?? undefined,
        firstName: ua.firstName,
        lastName: ua.lastName,
        middleName: ua.middleName || undefined,
        registrationStatus: ua.role === "student" ? studentRecord?.status : undefined,
      };

      loginAs(sessionUser);
      toast.success(`Welcome back, ${sessionUser.firstName || sessionUser.name}!`);

      if (ua.role === "student") {
        const nextStatus = studentRecord?.status?.toLowerCase();
        if (!nextStatus || nextStatus !== "approved") {
          navigate({ to: "/register" });
          return;
        }
        navigate({ to: "/dashboard/student" });
        return;
      }

      navigate({ to: roleDashboardPaths[ua.role] });
    } catch {
      setError("Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-maroon-dark px-4 py-16">
      <img
        src="/piat-landing/piat-classroom-session.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        fetchPriority="high"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(27,8,20,0.82),rgba(49,12,31,0.62)_55%,rgba(27,8,20,0.72))]"
      />
      <motion.div
        initial={isHydrated ? { opacity: 0, y: 24 } : false}
        animate={isHydrated ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.5 }}
        className="w-full max-w-6xl"
      >
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_26rem] md:gap-16">
          <div className="text-center md:text-left">
            <img
              src="/piat-logo.svg"
              alt="PIAT logo"
              className="mx-auto mb-6 h-16 w-16 rounded-full border border-white/40 bg-white object-cover shadow-lg md:mx-0"
            />
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
              Philtech Institute of Arts and Technology Inc.
            </p>
            <h1 className="mx-auto max-w-xl font-heading text-4xl font-semibold leading-tight text-white sm:text-5xl md:mx-0">
              Your PIAT community, all in one place.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-white/85 md:mx-0">
              Sign in to continue to your academic dashboard.
            </p>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl shadow-black/25 backdrop-blur-md sm:p-8">
            <h2 className="font-heading text-lg font-semibold text-foreground">User Login</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your registered email and password to continue.
            </p>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-foreground"
                  htmlFor="login-email"
                >
                  Username or email address
                </label>
                <input
                  id="login-email"
                  type="text"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="name@piat.edu.ph"
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-foreground"
                  htmlFor="login-password"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="Enter your password"
                    aria-describedby={error ? "login-error" : undefined}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-16 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-2 my-auto rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {error && (
                <p
                  id="login-error"
                  role="alert"
                  aria-live="polite"
                  className="text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" /> {isLoading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
      <footer className="absolute inset-x-0 bottom-0 border-t border-white/20 bg-black/20 px-4 py-4 text-center text-sm text-white/80 backdrop-blur">
        © 2026 PIAT Academic Management System
      </footer>
    </div>
  );
}
