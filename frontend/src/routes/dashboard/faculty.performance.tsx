import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Users, BookOpen, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchSubjectOfferings, type SubjectOffering } from "@/lib/api";
import { fetchEnrollments, fetchStudents, fetchGrades } from "@/lib/api";

export const Route = createFileRoute("/dashboard/faculty/performance")({
  component: FacultyPerformance,
});

function FacultyPerformance() {
  const { user } = useAuth();
  const [facultyOfferings, setFacultyOfferings] = useState<SubjectOffering[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [grades, setGrades] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const loadFacultyOfferings = useCallback(async () => {
    if (!user?.id) return;
    try {
      const allOfferings = await fetchSubjectOfferings();
      setFacultyOfferings(allOfferings.filter((o) => o.facultyId === (user.facultyId || user.id)));
    } catch {
      setFacultyOfferings([]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadFacultyOfferings();
  }, [loadFacultyOfferings]);

  useEffect(() => {
    if (!selectedOfferingId) {
      setGrades([]);
      setStudents([]);
      return;
    }

    const loadData = async () => {
      try {
        const allGrades = await fetchGrades({ offeringId: selectedOfferingId });
        setGrades(allGrades.filter((g) => g.type === "overall"));

        const enrollments = await fetchEnrollments({ offeringId: selectedOfferingId });
        const studentIds = enrollments.map((e) => e.studentId);
        const allStudents = await fetchStudents();
        setStudents(allStudents.filter((s) => studentIds.includes(s.id)));
      } catch {
        setGrades([]);
        setStudents([]);
      }
    };
    loadData();
  }, [selectedOfferingId]);

  const analytics = useMemo(() => {
    if (grades.length === 0) return null;

    const gradeValues = grades.map((g) => g.grade);
    const average = gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length;
    const passingGrade = 3.0;
    const passingCount = gradeValues.filter((g) => g <= passingGrade).length;
    const failingCount = gradeValues.filter((g) => g > passingGrade).length;
    const passingRate = (passingCount / gradeValues.length) * 100;

    const prelimGrades = grades.filter((g) => g.period === "prelim").map((g) => g.grade);
    const midtermGrades = grades.filter((g) => g.period === "midterm").map((g) => g.grade);
    const finalGrades = grades.filter((g) => g.period === "final").map((g) => g.grade);

    return {
      averageGrade: average,
      highestGrade: Math.max(...gradeValues),
      lowestGrade: Math.min(...gradeValues),
      passingRate,
      failedStudents: failingCount,
      totalStudents: students.length,
      prelimAverage:
        prelimGrades.length > 0 ? prelimGrades.reduce((a, b) => a + b, 0) / prelimGrades.length : 0,
      midtermAverage:
        midtermGrades.length > 0
          ? midtermGrades.reduce((a, b) => a + b, 0) / midtermGrades.length
          : 0,
      finalAverage:
        finalGrades.length > 0 ? finalGrades.reduce((a, b) => a + b, 0) / finalGrades.length : 0,
    };
  }, [grades, students]);

  const selectedOffering = facultyOfferings.find((o) => o.id === selectedOfferingId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Student Performance</h1>
        <p className="text-sm text-muted-foreground">
          View analytics and performance metrics for your subjects
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-heading text-sm font-semibold text-card-foreground mb-4">
          Select Subject Offering
        </h2>

        {facultyOfferings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subject offerings assigned yet.</p>
        ) : (
          <select
            value={selectedOfferingId}
            onChange={(e) => setSelectedOfferingId(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">Choose a subject</option>
            {facultyOfferings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.subjectCode} - {o.subjectTitle}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedOffering && analytics && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                <span className="text-xs text-muted-foreground">Class Average</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {analytics.averageGrade.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Highest Grade</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {analytics.highestGrade.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-xs text-muted-foreground">Lowest Grade</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{analytics.lowestGrade.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Total Students</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{analytics.totalStudents}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-accent" />
                <span className="text-xs text-muted-foreground">Period Averages</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prelim Average</span>
                  <span className="font-medium text-foreground">
                    {analytics.prelimAverage.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Midterm Average</span>
                  <span className="font-medium text-foreground">
                    {analytics.midtermAverage.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Final Average</span>
                  <span className="font-medium text-foreground">
                    {analytics.finalAverage.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-xs text-muted-foreground">Passing Statistics</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Passing Rate</span>
                  <span className="font-medium text-green-600">
                    {analytics.passingRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Failed Students</span>
                  <span className="font-medium text-red-600">{analytics.failedStudents}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${analytics.passingRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedOffering && !analytics && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No grade data available for this subject offering yet.
          </p>
        </div>
      )}
    </div>
  );
}