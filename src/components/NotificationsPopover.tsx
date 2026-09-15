import { Bell, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Notification, useNotifications } from "@/lib/notifications-store";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface NotificationsPopoverProps {
  userId: string | undefined;
}

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "grade":
        return "📚";
      case "schedule":
        return "📅";
    }
  };

  const getColor = (type: Notification["type"]) => {
    switch (type) {
      case "grade":
        return "bg-blue-50 hover:bg-blue-100";
      case "schedule":
        return "bg-purple-50 hover:bg-purple-100";
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg p-3 text-sm transition-colors",
        notification.read ? "opacity-60" : "",
        getColor(notification.type),
      )}
    >
      <div className="text-lg">{getIcon(notification.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground">{notification.title}</div>
        <div className="text-xs text-muted-foreground line-clamp-2">{notification.message}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
        </div>
      </div>
      {!notification.read && (
        <button
          onClick={() => onMarkAsRead(notification.id)}
          className="ml-2 p-1 hover:bg-white/50 rounded transition-colors shrink-0"
          title="Mark as read"
        >
          <Check className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export function NotificationsPopover({ userId }: NotificationsPopoverProps) {
  const { notifications, unreadCount, loading, markAsRead, clearAll } = useNotifications(userId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex flex-col h-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold text-sm">Notifications</h2>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                title="Clear all notifications"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>

          {/* Notifications List */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-full p-4 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-20" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y p-2">
                {notifications.map((notification) => (
                  <div key={notification.id} className="py-1">
                    <NotificationItem notification={notification} onMarkAsRead={markAsRead} />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
