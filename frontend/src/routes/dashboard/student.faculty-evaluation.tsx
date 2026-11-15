import { createFileRoute } from "@tanstack/react-router";
import { FacultyEvaluationPortal } from "@/components/FacultyEvaluationPortal";

export const Route = createFileRoute("/dashboard/student/faculty-evaluation")({
  component: () => <FacultyEvaluationPortal role="student" />,
});
