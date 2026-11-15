import { createFileRoute } from "@tanstack/react-router";
import { FacultyEvaluationPortal } from "@/components/FacultyEvaluationPortal";

export const Route = createFileRoute("/dashboard/admin/faculty-evaluations")({
  component: () => <FacultyEvaluationPortal role="admin" />,
});
