import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UserRole = "student" | "faculty" | "admin" | "registrar";

export interface User {
  id: string;
  facultyId?: string;
  name: string;
  email: string;
  role: UserRole;
  token?: string;
  studentId?: string;
    userId?: string;
  program?: string;
  yearLevel?: string;
  semester?: string;
  academicYear?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  registrationStatus?: string;
}

const STORAGE_KEY = "piat-auth-user";

function readStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: User | null;
  loginAs: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isHydrated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setUser(readStoredUser());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, [user, isHydrated]);

  const loginAs = (u: User) => {
    setUser(u);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loginAs, logout, isAuthenticated: !!user, isHydrated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
