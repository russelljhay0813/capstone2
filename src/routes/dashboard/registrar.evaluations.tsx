import { createFileRoute } from "@tanstack/react-router";
import { FacultyEvaluationPortal } from "@/components/FacultyEvaluationPortal";

export const Route = createFileRoute("/dashboard/registrar/evaluations")({
  component: () => <FacultyEvaluationPortal role="registrar" />,
});
