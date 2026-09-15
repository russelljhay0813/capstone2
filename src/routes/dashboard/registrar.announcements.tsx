import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { fetchAnnouncements, createAnnouncement, deleteAnnouncementApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/registrar/announcements")({
  component: RegistrarAnnouncements,
});

type Audience = "all" | "student" | "faculty";

function RegistrarAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");

  const loadAnnouncements = async () => {
    try {
      const data = await fetchAnnouncements();
      setAnnouncements(data);
    } catch {
      setAnnouncements([]);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreate = async () => {
    if (!title || !message) return toast.error("Title and message are required");
    try {
      await createAnnouncement({
        title,
        body: message,
        audience,
        authorName: "Registrar Office",
        authorRole: "registrar",
      });
      toast.success("Announcement posted");
      setShowModal(false);
      setTitle("");
      setMessage("");
      setAudience("all");
      loadAnnouncements();
    } catch (err: any) {
      toast.error(err?.message || "Failed to post announcement");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      await deleteAnnouncementApi(id);
      toast.success("Announcement deleted");
      loadAnnouncements();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete announcement");
    }
  };

  const audienceLabel = (a: string) => {
    switch (a) {
      case "all":
        return "All Students";
      case "student":
        return "Specific Students";
      case "faculty":
        return "Faculty";
      default:
        return a;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Post announcements to students and faculty
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" /> Post Announcement
        </Button>
      </div>

      <div className="space-y-3">
        {announcements.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No announcements yet</p>
          </div>
        )}
        {announcements.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-heading text-sm font-semibold text-foreground">{a.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {audienceLabel(a.audience || "all")}
                </p>
                <p className="text-sm text-muted-foreground mt-2">{a.body}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Posted:{" "}
                  {a.datePosted
                    ? new Date(a.datePosted).toLocaleDateString()
                    : new Date(a.createdAt).toLocaleDateString()}{" "}
                  by {a.authorName}
                </p>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Delete announcement ${a.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post Announcement</DialogTitle>
            <DialogDescription>
              Create an announcement for students and/or faculty
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <textarea
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter announcement message..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={(v: Audience) => setAudience(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="student">Students Only</SelectItem>
                  <SelectItem value="faculty">Faculty Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}