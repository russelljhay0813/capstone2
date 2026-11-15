import { createFileRoute } from "@tanstack/react-router";
import { AnnouncementsPage } from "./announcements";

export const Route = createFileRoute("/dashboard/admin/announcements")({
  component: AnnouncementsPage,
});