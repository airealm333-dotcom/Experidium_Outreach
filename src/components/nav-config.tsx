import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Kanban,
  FileEdit,
  Send,
  BarChart3,
  Upload,
  Settings,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Email Drafts", href: "/drafts", icon: FileEdit },
  { name: "Send Queue", href: "/send-queue", icon: Send },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Import", href: "/import", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
];
