import { useEffect, useState, useCallback } from "react";
import { fetchAnnouncements, createAnnouncement, deleteAnnouncementApi } from "./api";

export type AnnouncementCategory = "general" | "academic" | "event" | "urgent";

export type AnnouncementAudience = "all" | "student" | "faculty" | "registrar" | "admin";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  audience: AnnouncementAudience;
  pinned: boolean;
  authorName: string;
  authorRole: string;
  createdAt: number;
}

const EVENT = "bwest:announcements-changed";

function broadcastUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function useAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAnnouncements();
      const mapped: Announcement[] = (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        category: a.category || "general",
        audience: a.audience || "all",
        pinned: !!a.pinned,
        authorName: a.authorName || "System",
        authorRole: a.authorRole || "admin",
        createdAt: a.createdAt || Date.now(),
      }));
      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [refresh]);

  const add = useCallback(async (a: Omit<Announcement, "id" | "createdAt">) => {
    try {
      await createAnnouncement({
        title: a.title,
        body: a.body,
        audience: a.audience,
        authorName: a.authorName,
        authorRole: a.authorRole,
      });
      broadcastUpdate();
    } catch {
      // ignore
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteAnnouncementApi(id);
      broadcastUpdate();
    } catch {
      // ignore
    }
  }, []);

  const togglePin = useCallback(
    async (id: string) => {
      try {
        const current = items.find((a) => a.id === id);
        if (!current) return;
        const res = await fetch(`/api/announcements/${id}/pin`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: !current.pinned }),
        });
        if (res.ok) {
          broadcastUpdate();
        }
      } catch {
        // ignore
      }
    },
    [items],
  );

  return { items, loading, add, remove, togglePin, refresh };
}

export function canPostAnnouncements(role: string): boolean {
  return role === "admin" || role === "registrar" || role === "faculty";
}

export function visibleTo(a: Announcement, role: string): boolean {
  return a.audience === "all" || a.audience === role;
}
