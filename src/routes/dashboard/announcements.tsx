import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone,
  Pin,
  PinOff,
  Trash2,
  Plus,
  X,
  Search,
  AlertTriangle,
  GraduationCap,
  Calendar as CalendarIcon,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  canPostAnnouncements,
  visibleTo,
  type AnnouncementCategory,
  type AnnouncementAudience,
} from "@/lib/announcements-store";
import { fetchAnnouncements, createAnnouncement, deleteAnnouncementApi } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/announcements")({
  component: AnnouncementsPage,
});

const CATEGORY_META: Record<
  AnnouncementCategory,
  { label: string; icon: typeof Info; className: string }
> = {
  general: { label: "General", icon: Info, className: "bg-muted text-foreground" },
  academic: { label: "Academic", icon: GraduationCap, className: "bg-accent/10 text-accent" },
  event: { label: "Event", icon: CalendarIcon, className: "bg-primary/10 text-primary" },
  urgent: { label: "Urgent", icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ApiAnnouncement {
  id: string;
  title: string;
  body: string;
  category: string;
  audience: string;
  pinned: boolean | number;
  authorName: string;
  authorRole: string;
  createdAt: number;
  datePosted: string;
}

export function AnnouncementsPage() {
  const { user } = useAuth();
  const canPost = user ? canPostAnnouncements(user.role) : false;
  const [items, setItems] = useState<ApiAnnouncement[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AnnouncementCategory>("all");
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("general");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [pinned, setPinned] = useState(false);
  const [formError, setFormError] = useState("");

  const loadAnnouncements = async () => {
    try {
      const data = await fetchAnnouncements();
      setItems(
        Array.isArray(data)
          ? data.map((d: any) => ({
              ...d,
              category: d.category ?? "general",
              audience: d.audience ?? "all",
              authorName: d.authorName ?? "",
              authorRole: d.authorRole ?? "",
            }))
          : [],
      );
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const visible = useMemo(() => {
    const role = user?.role ?? "student";
    const q = search.trim().toLowerCase();
    return items
      .filter((a) => visibleTo({ ...a, authorRole: a.authorRole || "admin" } as any, role))
      .filter((a) => (filter === "all" ? true : a.category === filter))
      .filter((a) =>
        q ? a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
  }, [items, user, search, filter]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You need to be signed in to publish an announcement.");
      return;
    }

    if (!title.trim() || !body.trim()) {
      setFormError("Please add both a title and a message before publishing.");
      return;
    }

    setFormError("");

    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        audience: audience,
        authorName: user.name,
        authorRole: user.role,
      });
      setTitle("");
      setBody("");
      setCategory("general");
      setAudience("all");
      setPinned(false);
      setShowForm(false);
      toast.success("Your announcement was published.");
      loadAnnouncements();
    } catch (err: any) {
      toast.error(err?.message || "We couldn’t publish that announcement right now.");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await deleteAnnouncementApi(id);
      toast.success("Announcement removed.");
      loadAnnouncements();
    } catch (err: any) {
      toast.error(err?.message || "We couldn’t remove that announcement right now.");
    }
  };

  const handlePin = async (_id: string, _currentPinned: boolean) => {
    toast.info("Pinning is still being prepared for this release.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground">
            School-wide bulletin board for memos, events, and notices
          </p>
        </div>
        {canPost && (
          <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Post Announcement"}
          </Button>
        )}
      </div>

      <AnimatePresence>
        {showForm && canPost && (
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
                  <label
                    className="mb-1 block text-[11px] font-medium text-muted-foreground"
                    htmlFor="announcement-title"
                  >
                    Title
                  </label>
                  <input
                    id="announcement-title"
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (formError) setFormError("");
                    }}
                    placeholder="e.g., Midterm Schedule Released"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label
                    className="mb-1 block text-[11px] font-medium text-muted-foreground"
                    htmlFor="announcement-body"
                  >
                    Message
                  </label>
                  <textarea
                    id="announcement-body"
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      if (formError) setFormError("");
                    }}
                    rows={4}
                    placeholder="Write the announcement details..."
                    className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Category
                    </label>
                    <select
                      aria-label="Announcement category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    >
                      <option value="general">General</option>
                      <option value="academic">Academic</option>
                      <option value="event">Event</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      Audience
                    </label>
                    <select
                      aria-label="Announcement audience"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    >
                      <option value="all">Everyone</option>
                      <option value="student">Students only</option>
                      <option value="faculty">Faculty only</option>
                    </select>
                  </div>
                </div>

                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}

                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Pin to top
                </label>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={!title.trim() || !body.trim()}>
                    Publish
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap gap-1 rounded-lg border bg-background p-1">
          {(["all", "general", "academic", "event", "urgent"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No announcements to show</p>
          <p className="text-xs text-muted-foreground/70">
            {canPost ? "Be the first to post one." : "Check back later."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a, i) => (
            <AnnouncementCard
              key={a.id}
              a={{
                ...a,
                authorRole: a.authorRole || "admin",
              }}
              index={i}
              canManage={canPost}
              onPin={() => handlePin(a.id, a.pinned === 1)}
              onRemove={() => handleRemove(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({
  a,
  index,
  canManage,
  onPin,
  onRemove,
}: {
  a: ApiAnnouncement & { authorRole: string };
  index: number;
  canManage: boolean;
  onPin: () => void;
  onRemove: () => void;
}) {
  const meta = CATEGORY_META[a.category as AnnouncementCategory] || CATEGORY_META.general;
  const Icon = meta.icon;
  const isPinned = Boolean(a.pinned);
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className={`rounded-xl border bg-card p-5 shadow-sm ${isPinned ? "border-accent/40" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.className}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {isPinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-accent">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${meta.className}`}
              >
                {meta.label}
              </span>
              {a.audience !== "all" && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                  {a.audience} only
                </span>
              )}
            </div>
            <h3 className="mt-1.5 font-heading text-base font-semibold text-card-foreground">
              {a.title}
            </h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/80">{a.body}</p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Posted by <span className="font-medium text-foreground">{a.authorName}</span>
              <span className="capitalize"> · {a.authorRole}</span>
              <span> · {timeAgo(a.createdAt)}</span>
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onPin}
              title={isPinned ? "Unpin" : "Pin to top"}
            >
              {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onRemove}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </motion.article>
  );
}