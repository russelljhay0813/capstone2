import { createFileRoute } from "@tanstack/react-router";
import { FacultyEvaluationPortal } from "@/components/FacultyEvaluationPortal";

export const Route = createFileRoute("/dashboard/faculty/evaluations")({
  component: () => <FacultyEvaluationPortal role="faculty" />,
});
