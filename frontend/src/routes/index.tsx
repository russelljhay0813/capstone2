import { createFileRoute } from "@tanstack/react-router";
import LandingPage from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PIAT — Philtech Institute of Arts and Technology Inc." },
      {
        name: "description",
        content:
          "Welcome to PHILTECH INSTITUTE OF ARTS AND TECHNOLOGY INC. Explore the PIAT community and access the online portal.",
      },
    ],
  }),
  component: LandingPage,
});
