import { createFileRoute } from "@tanstack/react-router";
import LandingPage from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PIAT — Academic Management System" },
      {
        name: "description",
        content: "Public landing page for the PIAT Academic Management System.",
      },
    ],
  }),
  component: LandingPage,
});
