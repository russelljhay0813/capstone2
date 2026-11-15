import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { isAuthenticated, isHydrated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, isHydrated, navigate]);

  if (!isHydrated || !isAuthenticated) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <DashboardHeader />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
