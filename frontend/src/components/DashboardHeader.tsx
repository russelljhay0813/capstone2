import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { NotificationsPopover } from "@/components/NotificationsPopover";

export function DashboardHeader() {
  const { user } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <span className="text-sm text-muted-foreground">
          Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsPopover userId={user?.id} />
      </div>
    </header>
  );
}
