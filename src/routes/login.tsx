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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(122,20,20,0.12),transparent_60%)] px-4 py-16">
      <motion.div
        initial={isHydrated ? { opacity: 0, y: 24 } : false}
        animate={isHydrated ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <img
            src="/piat-logo.svg"
            alt="PIAT logo"
            className="mx-auto mb-4 h-16 w-16 rounded-full border border-primary/20 bg-white object-cover shadow-lg"
          />
          <h1 className="font-heading text-3xl font-semibold text-foreground">
            PIAT Academic Management System
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Secure sign-in for students, faculty, registrar, and administrators.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-maroon-primary/10">
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
      </motion.div>
      <footer className="absolute bottom-0 w-full border-t border-border/70 bg-background/80 px-4 py-4 text-center text-sm text-muted-foreground backdrop-blur">
        © 2026 PIAT Academic Management System
      </footer>
    </div>
  );
}