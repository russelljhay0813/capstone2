import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Plus, X, Search, Calendar as CalendarIcon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { fetchSubjectOfferings, type SubjectOffering } from "@/lib/api";

export const Route = createFileRoute("/dashboard/faculty/announcements")({
  component: FacultyAnnouncements,
});

interface Announcement {
  id: string;
  title: string;
  body: string;
  category: "general" | "academic" | "event" | "urgent";
  audience: "all" | "student" | "faculty";
  subjectId?: string;
  pinned: boolean;
  authorName: string;
  authorRole: string;
  createdAt: number;
  datePosted: string;
}

function FacultyAnnouncements() {
  const { user } = useAuth();
  const [facultyOfferings, setFacultyOfferings] = useState<SubjectOffering[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<"general" | "academic" | "event" | "urgent">("academic");
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");

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
    const loadAnnouncements = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE ?? ""}/api/announcements`).then(
          (r) => r.json(),
        );
        setAnnouncements(res);
      } catch {
        setAnnouncements([]);
      }
    };
    loadAnnouncements();
  }, []);

  const filteredAnns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return announcements.filter((a) =>
      q ? a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) : true,
    );
  }, [announcements, search]);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || !user) return;

    const newAnnouncement: Announcement = {
      id: `a-${Date.now()}`,
      title: title.trim(),
      body: body.trim(),
      category,
      audience: "student",
      subjectId: selectedOfferingId || undefined,
      pinned: false,
      authorName: user.firstName || user.name || "Faculty",
      authorRole: "faculty",
      createdAt: Date.now(),
      datePosted: new Date().toISOString().split("T")[0],
    };

    try {
      await fetch(`${import.meta.env.VITE_API_BASE ?? ""}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAnnouncement),
      }).then((r) => r.json());

      setAnnouncements((prev) => [newAnnouncement, ...prev]);
      setTitle("");
      setBody("");
      setSelectedOfferingId("");
      setShowForm(false);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Post announcements for your assigned classes
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Post Announcement"}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-3 font-heading text-sm font-semibold text-card-foreground">
                New Announcement
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Midterm Schedule Released"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    Message
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    placeholder="Write the announcement details..."
                    className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="announcement-category"
                      className="mb-1 block text-[11px] font-medium text-muted-foreground"
                    >
                      Category
                    </label>
                    <select
                      id="announcement-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    >
                      <option value="general">General</option>
                      <option value="academic">Academic</option>
                      <option value="event">Event</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="announcement-subject"
                      className="mb-1 block text-[11px] font-medium text-muted-foreground"
                    >
                      Subject Offering (Optional)
                    </label>
                    <select
                      id="announcement-subject"
                      value={selectedOfferingId}
                      onChange={(e) => setSelectedOfferingId(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    >
                      <option value="">All My Subjects</option>
                      {facultyOfferings.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.subjectCode} - {o.subjectTitle}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={!title.trim() || !body.trim()}>
                    <Send className="mr-1 h-3.5 w-3.5" />
                    Publish
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search announcements"
          className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-xs focus:border-accent focus:outline-none"
        />
      </div>

      {filteredAnns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No announcements posted</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnns.map((a, i) => (
            <AnnouncementCard key={a.id} a={a} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ a, index }: { a: Announcement; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className="rounded-xl border bg-card p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <Megaphone className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-accent">
                {a.category}
              </span>
            </div>
            <h3 className="mt-1.5 font-heading text-base font-semibold text-card-foreground">
              {a.title}
            </h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/80">{a.body}</p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Posted by <span className="font-medium text-foreground">{a.authorName}</span>
              <span> · {a.datePosted}</span>
            </p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}