import {
  Bot,
  BookOpen,
  Brain,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  FolderInput,
  Gauge,
  LayoutDashboard,
  ListOrdered,
  NotebookPen,
  Settings,
  ShieldAlert,
  Tags,
  Target,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/trades", label: "Trades", icon: ListOrdered },
      { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Journal",
    items: [
      { href: "/journal", label: "Daily journal", icon: NotebookPen },
      { href: "/notebook", label: "Notebook", icon: BookOpen },
      { href: "/playbook", label: "Playbook", icon: Gauge },
      { href: "/psychology", label: "Psychology", icon: Brain },
    ],
  },
  {
    label: "Discipline",
    items: [
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/risk", label: "Risk tools", icon: ShieldAlert },
      { href: "/challenges", label: "Challenges", icon: Trophy },
      { href: "/insights", label: "AI insights", icon: Bot },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/accounts", label: "Accounts", icon: Wallet },
      { href: "/import", label: "Import", icon: FolderInput },
      { href: "/tags", label: "Tags & mistakes", icon: Tags },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((g) => g.items);
