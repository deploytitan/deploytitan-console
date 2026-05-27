"use client";

/**
 * ConsoleSidebar — fixed left sidebar for the DeployTitan console.
 *
 * Navigation design:
 * - All suite/project links are only shown when both orgSlug and projectSlug
 *   are present in the current URL. URLs are fully qualified — no context magic.
 * - The org/project switchers navigate to the selected org/project overview URL.
 * - When no project is selected, only org-level items are shown.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Link, useMatchRoute, useNavigate, useParams } from "@/lib/navigation";
import {
  BookOpen,
  CreditCard,
  Eye,
  GitBranch,
  GitPullRequest,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  Network,
  Plug,
  Rocket,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { useOrgProject } from "../../contexts/OrgProjectContext";
import { useProjectList } from "../../hooks/useProjectList";
import { SwitcherPopover, SwitcherTrigger } from "./SwitcherPopover";
import { OrgSwitcherWidget } from "./OrgSwitcherWidget";
import { UserAvatar } from "../ui/UserAvatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  /** Path suffix under /orgs/:orgSlug/projects/:projectSlug/ */
  suffix: string;
  icon: React.ElementType;
}

const NAV_CORE: NavItem[] = [
  { label: "Overview", suffix: "overview", icon: LayoutDashboard },
];

const NAV_SUITE: NavItem[] = [
  { label: "Pull Requests", suffix: "pull-requests", icon: GitPullRequest },
  { label: "Rollouts", suffix: "rollouts", icon: Rocket },
  { label: "Foresight", suffix: "foresight", icon: Eye },
  { label: "Rollback", suffix: "rollback", icon: RotateCcw },
  { label: "Ledger", suffix: "ledger", icon: BookOpen },
  { label: "Timeline", suffix: "timeline", icon: GitBranch },
  { label: "Observatory", suffix: "observatory", icon: Network },
];

const NAV_CONFIG: NavItem[] = [
  { label: "Policies", suffix: "policies", icon: Shield },
  { label: "Integrate", suffix: "integrate", icon: Plug },
  { label: "Configure with AI", suffix: "configure", icon: Sparkles },
  { label: "Settings", suffix: "settings", icon: Settings },
];

// ─── Theme helpers ────────────────────────────────────────────────────────────

function getInitialTheme(): "dark" | "light" {
  try {
    const stored = localStorage.getItem("dt-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage may be unavailable
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  try {
    localStorage.setItem("dt-theme", theme);
  } catch {
    // ignore
  }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function ConsoleSidebar() {
  const { user, logout } = useAuth();
  const { orgId, orgName, projectId, projectName } = useOrgProject();
  const pathname = usePathname();
  const isOverview = pathname === "/overview";
  const navigate = useNavigate();

  // Read org/project IDs directly from the URL — this is the source of truth
  const routeParams = useParams({ strict: false }) as {
    orgId?: string;
    projectId?: string;
  };
  const routeOrgId = routeParams.orgId ?? null;
  const routeProjectId = routeParams.projectId ?? null;
  const hasProject = !!routeOrgId && !!routeProjectId;

  const projectPopoverId = useId();

  const [projectOpen, setProjectOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);

  const projectTriggerRef = useRef<HTMLButtonElement>(null);

  const { projects: zeroProjects, isLoading: projectsLoading } =
    useProjectList(orgId);

  const projects = zeroProjects;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <Sidebar
      collapsible="none"
      className="border-r border-sidebar-border"
      style={{ viewTransitionName: "console-sidebar" }}
    >
      {/* ── Brand header ── */}
      <SidebarHeader className="h-14 flex-row items-center gap-2.5 px-4 border-b border-sidebar-border">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center bg-ink"
          style={{ borderRadius: "2px" }}
          aria-hidden="true"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-surface)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span className="font-sans text-[13px] font-semibold tracking-tight leading-none">
          <span className="text-sidebar-foreground">Deploy</span>
          <span style={{ color: "var(--color-primary-dark, #a68a3e)" }}>
            Titan
          </span>
        </span>
      </SidebarHeader>

      {/* ── All organizations link ── */}
      <div className="shrink-0 px-2 pt-2.5 pb-1">
        <Link
          to="/overview"
          className={[
            "flex items-center gap-2 px-2 py-1.5 rounded-[6px] w-full transition-colors duration-150 text-left",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
            "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
          ].join(" ")}
        >
          <LayoutGrid size={14} strokeWidth={1.75} className="shrink-0" />
          <span
            className="text-[12px] font-medium"
            style={{ fontFamily: "Instrument Sans, system-ui, sans-serif" }}
          >
            All organizations
          </span>
        </Link>
      </div>

      {/* ── Org / Project switchers ── */}
      {!isOverview && (
        <div className="shrink-0 border-b border-sidebar-border px-2 py-2.5 space-y-0.5">
          <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-widest text-sidebar-foreground/40 select-none">
            Organization
          </p>
          <OrgSwitcherWidget />

          {routeOrgId && (
            <>
              <p className="px-2 pt-2 pb-1 font-mono text-[9px] uppercase tracking-widest text-sidebar-foreground/40 select-none">
                Project
              </p>
              <SwitcherTrigger
                label={projectName ?? routeProjectId ?? "Select project"}
                dim={!projectName && !routeProjectId}
                open={projectOpen}
                onClick={() => {
                  setProjectOpen((v) => !v);
                }}
                aria-expanded={projectOpen}
                aria-controls={projectPopoverId}
                triggerRef={projectTriggerRef}
              />
              <SwitcherPopover
                open={projectOpen}
                onClose={() => setProjectOpen(false)}
                triggerRef={projectTriggerRef}
                items={projects}
                selectedId={projectId}
                onSelect={(item) =>
                  navigate({
                    to: "/orgs/$orgId/projects/$projectId/overview",
                    params: { orgId: orgId ?? routeOrgId, projectId: item.id },
                  })
                }
                isLoading={projectsLoading}
                emptyMessage="No projects in this organization."
                action={{
                  label: "New project",
                  onAction: () =>
                    navigate({
                      to: "/orgs/$orgId",
                      params: { orgId: orgId ?? routeOrgId },
                    }),
                }}
                label="Select project"
              />
            </>
          )}
        </div>
      )}

      {/* ── Navigation — only shown when project is in URL ── */}
      {hasProject && (
        <SidebarContent className="py-2">
          {/* Overview */}
          <SidebarGroup>
            <SidebarMenu>
              {NAV_CORE.map((item) => (
                <ProjectNavItem
                  key={item.suffix}
                  item={item}
                  orgId={routeOrgId!}
                  projectId={routeProjectId!}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarSeparator className="mx-3 my-1" />

          {/* Suite products */}
          <SidebarGroup>
            <p className="px-3 pb-1 pt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-sidebar-foreground/35 select-none">
              Suite
            </p>
            <SidebarMenu>
              {NAV_SUITE.map((item) => (
                <ProjectNavItem
                  key={item.suffix}
                  item={item}
                  orgId={routeOrgId!}
                  projectId={routeProjectId!}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarSeparator className="mx-3 my-1" />

          {/* Config */}
          <SidebarGroup>
            <SidebarMenu>
              {NAV_CONFIG.map((item) => (
                <ProjectNavItem
                  key={item.suffix}
                  item={item}
                  orgId={routeOrgId!}
                  projectId={routeProjectId!}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      )}

      {/* When no project selected, show empty content area */}
      {!hasProject && <SidebarContent className="py-2" />}

      {/* ── Footer: connection status + user menu ── */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <UserMenuButton
          user={user}
          theme={theme}
          toggleTheme={toggleTheme}
          onLogout={handleLogout}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

// ── Project-scoped nav item ───────────────────────────────────────────────────

function ProjectNavItem({
  item,
  orgId,
  projectId,
}: {
  item: NavItem;
  orgId: string;
  projectId: string;
}) {
  const matchRoute = useMatchRoute();
  const to =
    `/orgs/$orgId/projects/$projectId/${item.suffix}` as "/orgs/$orgId/projects/$projectId/overview";
  const params = { orgId, projectId };
  const isActive = !!matchRoute({ to, params, fuzzy: true });

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to={to} params={params} />}
        isActive={isActive}
        className={[
          "!rounded-[6px] text-[13px] gap-2.5 font-sans font-normal",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
        ].join(" ")}
      >
        <item.icon size={15} strokeWidth={isActive ? 2 : 1.75} />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ── User menu popover ─────────────────────────────────────────────────────────

function UserMenuButton({
  user,
  theme,
  toggleTheme,
  onLogout,
}: {
  user: ReturnType<typeof useAuth>["user"];
  theme: "dark" | "light";
  toggleTheme: () => void;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const displayName = user?.firstName
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : (user?.email ?? "—");

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={[
          "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[6px] transition-colors text-left",
          "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
          open ? "bg-sidebar-accent text-sidebar-foreground" : "",
        ].join(" ")}
      >
        {user && (
          <UserAvatar
            profilePictureUrl={user.profilePictureUrl}
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            size="sm"
          />
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="truncate text-[12px] font-medium leading-tight">
            {displayName}
          </span>
          {user?.email && (
            <span className="truncate text-[10px] font-mono text-sidebar-foreground/40 leading-tight mt-0.5">
              {user.email}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={[
            "absolute bottom-full left-0 right-0 mb-1 z-50",
            "border border-sidebar-border bg-sidebar shadow-lg",
            "overflow-hidden py-1",
          ].join(" ")}
          style={{ borderRadius: "6px" }}
        >
          <div className="px-3 py-2.5 border-b border-sidebar-border">
            <p className="text-[12px] font-medium text-sidebar-foreground truncate">
              {displayName}
            </p>
            {user?.email && (
              <p className="text-[10px] text-sidebar-foreground/40 truncate font-mono mt-0.5">
                {user.email}
              </p>
            )}
          </div>

          <div className="py-1">
            <MenuRow
              icon={<User size={13} />}
              label="Profile settings"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/settings" });
              }}
            />
            <MenuRow
              icon={<CreditCard size={13} />}
              label="Billing"
              onClick={() => {
                setOpen(false);
                navigate({ to: "/billing" });
              }}
            />
          </div>

          <div className="border-t border-sidebar-border py-1">
            <MenuRow
              icon={theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
              label={theme === "dark" ? "Light mode" : "Dark mode"}
              onClick={toggleTheme}
            />
          </div>

          <div className="border-t border-sidebar-border py-1">
            <MenuRow
              icon={<LogOut size={13} />}
              label="Sign out"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              danger
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] transition-colors text-left",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sidebar-ring",
        danger
          ? "text-signal-danger/80 hover:text-signal-danger hover:bg-signal-danger/8"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
      ].join(" ")}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}
