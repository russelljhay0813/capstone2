import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarDays, Clock, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEnrollments } from "@/lib/enrollment-store"; // returns offerings with schedule

export const Route = createFileRoute("/dashboard/student/schedule")({
  component: StudentSchedule,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY_KEYS: Record<string, (typeof DAYS)[number]> = {
  M: "Mon",
  MON: "Mon",
  MONDAY: "Mon",
  T: "Tue",
  TU: "Tue",
  TUE: "Tue",
  TUESDAY: "Tue",
  W: "Wed",
  WED: "Wed",
  WEDNESDAY: "Wed",
  TH: "Thu",
  THU: "Thu",
  THURSDAY: "Thu",
  F: "Fri",
  FRI: "Fri",
  FRIDAY: "Fri",
  S: "Sat",
  SAT: "Sat",
  SATURDAY: "Sat",
};

function parseDays(schedule: string): (typeof DAYS)[number][] {
  const head = schedule.split(/\s+/)[0]?.toUpperCase() ?? "";
  const found = new Set<(typeof DAYS)[number]>();
  const tokens = head.replace(/[^A-Z]/g, "");
  let i = 0;
  while (i < tokens.length) {
    const two = tokens.slice(i, i + 2);
    if (DAY_KEYS[two]) {
      found.add(DAY_KEYS[two]);
      i += 2;
      continue;
    }
    const one = tokens[i];
    if (DAY_KEYS[one]) found.add(DAY_KEYS[one]);
    i += 1;
  }
  return DAYS.filter((d) => found.has(d));
}

function parseTime(schedule: string): string {
  const m = schedule.match(/\d{1,2}(:\d{2})?\s*(AM|PM)?\s*[-–]\s*\d{1,2}(:\d{2})?\s*(AM|PM)?/i);
  return m ? m[0] : schedule;
}

function StudentSchedule() {
  const { user } = useAuth();
  const enrollments = useEnrollments(user?.studentId ?? ""); // returns offerings with subject details

  const byDay: Record<(typeof DAYS)[number], typeof enrollments> = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
  };
  enrollments.forEach((enrollment) => {
    const offering = enrollment; // assuming enrollment includes offering details
    const days = parseDays(offering.schedule || "");
    if (days.length === 0) byDay.Mon.push(enrollment);
    days.forEach((d) => byDay[d].push(enrollment));
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Class Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Weekly view of all subject offerings assigned to you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Classes</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{enrollments.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Active Days</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">
            {DAYS.filter((d) => byDay[d].length > 0).length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Semester</p>
          <p className="mt-1 font-heading text-2xl font-bold text-accent">
            {enrollments[0]?.semester || enrollments[0]?.semesterName || "—"}
          </p>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/50 px-4 py-10 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No classes scheduled yet. Offerings will appear once enrolled.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DAYS.map((day) => (
            <motion.div
              key={day}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-accent" />
                  <h2 className="font-heading text-sm font-semibold text-card-foreground">{day}</h2>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {byDay[day].length} {byDay[day].length === 1 ? "class" : "classes"}
                </span>
              </div>

              {byDay[day].length === 0 ? (
                <p className="rounded-lg bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
                  No classes
                </p>
              ) : (
                <div className="space-y-2">
                  {byDay[day].map((enrollment) => (
                    <div
                      key={enrollment.id + day}
                      className="rounded-lg border-l-2 border-accent bg-muted/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-heading text-xs font-bold text-foreground">
                          {enrollment.subjectCode}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{enrollment.units}u</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-foreground">{enrollment.subjectTitle}</p>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {parseTime(enrollment.schedule || "")}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {enrollment.room || "TBA"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}