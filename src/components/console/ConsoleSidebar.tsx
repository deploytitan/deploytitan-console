"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useAuth, useAccessToken } from "@workos-inc/authkit-nextjs/components";
import { OrganizationSwitcher } from "@workos-inc/widgets";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ConnectionStatus } from "@/components/console/ConnectionStatus";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Rocket,
  ScrollText,
  Activity,
  GitPullRequest,
  RotateCcw,
  History,
  Shield,
  Plug2,
  SlidersHorizontal,
  Settings,
  Zap,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { queries } from "@deploytitan/zero-schema";
import { useQuery, useZero } from "@rocicorp/zero/react";

type NavItem =
  | {
      type: "group";
      label: string;
      icon?: LucideIcon;
      badge?: string;
      items: NavItem[];
    }
  | {
      type: "item";
      label: string;
      href: string;
      icon: LucideIcon;
      badge?: string;
      items?: NavItem[];
    };

const generateProjectNav = (orgId: string, projectId: string): NavItem[] => [
  {
    label: "Project",
    type: "group",
    items: [
      {
        type: "item",
        label: "Overview",
        icon: LayoutGrid,
        href: `/orgs/${orgId}/projects/${projectId}/overview`,
      },
      {
        type: "item",
        label: "Policies",
        icon: Shield,
        href: `/orgs/${orgId}/projects/${projectId}/policies`,
      },
      // { label: "Rollouts", href: "rollouts", icon: Rocket },
      // { label: "Ledger", href: "ledger", icon: ScrollText },
      // { label: "Observatory", href: "observatory", icon: Activity },
      // { label: "Pull Requests", href: "pull-requests", icon: GitPullRequest },
      // { label: "Timeline", href: "timeline", icon: History },
      // { label: "Rollback", href: "rollback", icon: RotateCcw },
      // { label: "Foresight", href: "foresight", icon: Zap, badge: "BETA" },
      // { label: "Integrate", href: "integrate", icon: Plug2 },
      // { label: "Configure", href: "configure", icon: SlidersHorizontal },
      // { label: "Settings", href: "settings", icon: Settings },
    ],
  },
];

const generateOrgNav = (orgId: string): NavItem[] => [
  {
    type: "item",
    label: "Project List",
    href: `/orgs/${orgId}/projects`,
    icon: LayoutGrid,
  },
  {
    type: "item",
    href: `/orgs/${orgId}/settings`,
    icon: Settings,
    label: "Settings",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block px-3 mb-0.5 font-mono uppercase tracking-[0.08em] text-[9px] text-sidebar-foreground/40 select-none">
      {children}
    </span>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  badge,
  active,
}: {
  href: string;
  icon?: LucideIcon;
  label: string;
  badge?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors duration-100",
        "rounded-[4px] leading-none",
        active
          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
          : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/70",
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            "size-3.5 shrink-0 transition-opacity duration-100",
            active ? "opacity-100" : "opacity-50 group-hover:opacity-70",
          )}
          strokeWidth={active ? 2 : 1.75}
        />
      ) : undefined}
      <span className="truncate">{label}</span>
      {badge && (
        <span
          className="ml-auto font-mono uppercase tracking-[0.06em] text-[8px] text-sidebar-foreground/40 bg-sidebar-accent/80 px-1 py-px"
          style={{ borderRadius: "2px" }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function ProjectDisplay() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const [projectDetails] = useQuery(queries.projectById({ id: projectId }));
  const projectName = projectDetails?.name;

  return (
    <div className="px-2 pb-2">
      <SectionLabel>Project</SectionLabel>
      <div
        className="flex items-center gap-2 px-2 py-1.5 bg-sidebar-accent/50 border border-sidebar-border"
        style={{ borderRadius: "4px" }}
      >
        <span className="font-mono text-[11px] tracking-wide text-sidebar-foreground/70 truncate">
          {projectName}
        </span>
      </div>
    </div>
  );
}

function NavGroupList({ navList }: { navList: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => {
    return pathname.includes(href);
  };

  return navList.map((nav) => (
    <div key={nav.label}>
      {nav.type === "group" && <SectionLabel>{nav.label}</SectionLabel>}
      <div className="space-y-0.5">
        {nav.items?.map((item) =>
          item.type === "group" ? (
            <NavGroupList navList={item.items} />
          ) : (
            <NavLink
              key={item.href}
              href={item.href || ""}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              active={item.href ? isActive(item.href) : false}
            />
          ),
        )}
      </div>
    </div>
  ));
}

export function ConsoleSidebar() {
  const params = useParams();
  const { user } = useAuth();

  const orgId = params?.orgId as string | undefined;
  const projectId = params?.projectId as string | undefined;

  const displayName = user?.firstName
    ? user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName
    : (user?.email?.split("@")[0] ?? "");

  if (!orgId) return;

  const navList = projectId
    ? generateProjectNav(orgId, projectId)
    : generateOrgNav(orgId);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col bg-sidebar border-r border-sidebar-border"
      style={{ viewTransitionName: "console-sidebar" }}
      aria-label="Console navigation"
    >
      {/* Logo */}
      <div className="flex h-11 shrink-0 items-center px-4 border-b border-sidebar-border">
        <BrandLogo className="w-28" />
      </div>

      {/* Project display */}
      {projectId && (
        <div className="shrink-0 pt-2 border-b border-sidebar-border">
          <ProjectDisplay />
        </div>
      )}

      {/* Nav — scrollable */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {projectId && (
          <Link
            href={`/orgs/${orgId}/projects`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors duration-100 rounded-[4px] hover:bg-sidebar-accent/70"
          >
            <ChevronLeft className="size-3.5 shrink-0" strokeWidth={1.75} />
            All Projects
          </Link>
        )}
        <NavGroupList navList={navList} />
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-sidebar-border">
        <div className="flex items-center justify-between px-3 py-2">
          <ConnectionStatus />
          <ThemeToggle />
        </div>
        {user && (
          <div className="flex items-center gap-2.5 px-3 pb-3 pt-1">
            <UserAvatar
              profilePictureUrl={user.profilePictureUrl}
              firstName={user.firstName}
              lastName={user.lastName}
              email={user.email}
            />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-sidebar-foreground truncate leading-tight">
                {displayName}
              </p>
              <p className="font-mono text-[9px] tracking-wide text-sidebar-foreground/45 truncate leading-tight mt-0.5">
                {user.email}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
