import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  FileText,
  Calendar,
  Shield,
  UserCheck,
  Brain,
  Megaphone,
  UserPlus,
  RefreshCw,
  Building2,
  Printer,
  PieChart,
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth, type UserRole } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  student: [
    { title: "Dashboard", url: "/dashboard/student", icon: LayoutDashboard },
    { title: "Enrollment", url: "/dashboard/student/enrollment", icon: ClipboardList },
    { title: "Grades", url: "/dashboard/student/grades", icon: BookOpen },
    { title: "Schedule", url: "/dashboard/student/schedule", icon: Calendar },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
  ],
  faculty: [
    { title: "Dashboard", url: "/dashboard/faculty", icon: LayoutDashboard },
    { title: "My Subjects", url: "/dashboard/faculty/subjects", icon: BookOpen },
    { title: "Class List", url: "/dashboard/faculty/classes", icon: Users },
    { title: "Attendance", url: "/dashboard/faculty/attendance", icon: UserCheck },
    { title: "Gradebook", url: "/dashboard/faculty/grades", icon: ClipboardList },
    { title: "Student Performance", url: "/dashboard/faculty/performance", icon: BarChart3 },
    { title: "Announcements", url: "/dashboard/faculty/announcements", icon: Megaphone },
    { title: "Profile", url: "/dashboard/faculty/profile", icon: Settings },
  ],
  admin: [
    { title: "Dashboard", url: "/dashboard/admin", icon: LayoutDashboard },
    { title: "Users", url: "/dashboard/admin/users", icon: Users },
    { title: "Analytics", url: "/dashboard/admin/analytics", icon: BarChart3 },
    { title: "Security", url: "/dashboard/admin/security", icon: Shield },
    { title: "Settings", url: "/dashboard/admin/settings", icon: Settings },
    { title: "Announcements", url: "/dashboard/admin/announcements", icon: Megaphone },
  ],
  registrar: [
    { title: "Dashboard", url: "/dashboard/registrar", icon: LayoutDashboard },
    { title: "Student Applications", url: "/dashboard/registrar/registrations", icon: UserPlus },
    { title: "Student Registration", url: "/dashboard/registrar/students", icon: UserCheck },
    { title: "Enrollment", url: "/dashboard/registrar/enrollment", icon: ClipboardList },
    { title: "Re-enrollment", url: "/dashboard/registrar/reenrollment", icon: RefreshCw },
    { title: "Programs & Curriculum", url: "/dashboard/registrar/curriculum", icon: Building2 },
    { title: "Subject Offerings", url: "/dashboard/registrar/subjects", icon: BookOpen },
    { title: "Faculty Assignment", url: "/dashboard/registrar/faculty", icon: Users },
    { title: "Academic Records", url: "/dashboard/registrar/records", icon: FileText },
    { title: "Reports", url: "/dashboard/registrar/reports", icon: PieChart },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
    { title: "Profile", url: "/dashboard/registrar/profile", icon: Settings },
  ],
};

const roleLabels: Record<UserRole, string> = {
  student: "Student Portal",
  faculty: "Faculty Portal",
  admin: "Administration",
  registrar: "Registrar Office",
};

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  if (!user) return null;

  const navItems = roleNavItems[user.role];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img
              src="/piat-logo.svg"
              alt="PIAT logo"
              className="h-8 w-8 rounded-md border border-sidebar-border/60 bg-white object-cover"
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-heading text-sm font-bold tracking-wide text-sidebar-primary-foreground">
                PIAT
              </span>
              <span className="text-xs text-sidebar-foreground/60">{roleLabels[user.role]}</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-white">
            <img src="/piat-logo.svg" alt="PIAT logo" className="h-full w-full object-cover" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-sidebar-foreground">{user.name}</span>
              <span className="text-[10px] text-sidebar-foreground/50">{user.email}</span>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
