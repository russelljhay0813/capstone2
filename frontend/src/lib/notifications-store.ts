import { useEffect, useState, useCallback } from "react";

export type NotificationType = "grade" | "schedule";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  relatedId?: string;
}

const EVENT = "bwest:notifications-changed";

function broadcastUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

async function fetchNotifications(userId: string): Promise<Notification[]> {
  try {
    const response = await fetch(`/api/notifications?userId=${userId}`);
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await fetch(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
    broadcastUpdate();
  } catch {
    // ignore errors
  }
}

async function clearAllNotifications(userId: string): Promise<void> {
  try {
    await fetch(`/api/notifications?userId=${userId}`, { method: "DELETE" });
    broadcastUpdate();
  } catch {
    // ignore errors
  }
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: string,
): Promise<void> {
  try {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, type, title, message, relatedId }),
    });
    broadcastUpdate();
  } catch {
    // ignore errors
  }
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchNotifications(userId);
    setNotifications(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener(EVENT, handleUpdate);
    return () => window.removeEventListener(EVENT, handleUpdate);
  }, [refresh]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
  }, []);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    await clearAllNotifications(userId);
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    clearAll,
    refresh,
  };
}
