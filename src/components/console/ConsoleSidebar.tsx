"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useQuery } from "@tanstack/react-query";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ConnectionStatus } from "@/components/console/ConnectionStatus";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/actions/auth";
import { getProjectOverview } from "@/lib/console/http";
import { Menu } from "@base-ui/react/menu";
import {
  Building2,
  ChevronLeft,
  ChevronUp,
  LayoutGrid,
  LogOut,
  type LucideIcon,
  PackageCheck,
  Settings,
} from "lucide-react";

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
      exact?: boolean;
      items?: NavItem[];
    };

const generateProjectNav = (
  orgId: string,
  projectPublicId: string,
): NavItem[] => [
  {
    label: "Project",
    type: "group",
    items: [
      {
        type: "item",
        label: "Overview",
        icon: LayoutGrid,
        href: `/orgs/${orgId}/projects/${projectPublicId}/overview`,
      },
      {
        type: "item",
        label: "Releases",
        icon: PackageCheck,
        href: `/orgs/${orgId}/projects/${projectPublicId}/releases`,
      },
    ],
  },
];

const generateOrgNav = (orgId: string): NavItem[] => [
  {
    type: "item",
    label: "Overview",
    href: `/orgs/${orgId}`,
    icon: Building2,
    exact: true,
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
    <span className="block px-3 mb-2 font-mono uppercase tracking-[0.08em] text-[9px] text-sidebar-foreground select-none">
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
        "group flex items-center gap-2 px-3 py-2 text-[13px] transition-colors duration-100",
        "rounded-[4px] leading-none",
        active
          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
          : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/70",
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
          className="ml-auto font-mono uppercase tracking-[0.06em] text-[8px] text-sidebar-foreground bg-sidebar-accent/80 px-1 py-px"
          style={{ borderRadius: "4px" }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function ProjectDisplay() {
  const params = useParams();
  const projectPublicId = params?.projectId as string | undefined;
  const { data } = useQuery({
    queryKey: ["project-overview", projectPublicId],
    queryFn: () => getProjectOverview(projectPublicId ?? ""),
    enabled: Boolean(projectPublicId),
    staleTime: 30_000,
  });
  const projectName = data?.project?.name;

  return (
    <div className="px-3 pb-3">
      <SectionLabel>Project</SectionLabel>
      <div
        className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent/50 border border-sidebar-border"
        style={{ borderRadius: "4px" }}
      >
        <span className="font-mono text-[11px] tracking-wide text-sidebar-foreground truncate">
          {projectName}
        </span>
      </div>
    </div>
  );
}

function NavGroupList({ navList }: { navList: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.includes(href);

  return navList.map((nav) => {
    if (nav.type === "item") {
      return (
        <NavLink
          key={nav.href}
          href={nav.href}
          icon={nav.icon}
          label={nav.label}
          badge={nav.badge}
          active={isActive(nav.href, nav.exact)}
        />
      );
    }
    return (
      <div key={nav.label}>
        <SectionLabel>{nav.label}</SectionLabel>
        <div className="space-y-1">
          {nav.items.map((item) =>
            item.type === "group" ? (
              <NavGroupList key={item.label} navList={item.items} />
            ) : (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                active={isActive(item.href, item.exact)}
              />
            ),
          )}
        </div>
      </div>
    );
  });
}

export function ConsoleSidebar() {
  const params = useParams();
  const { user } = useAuth();

  const orgId = params?.orgId as string | undefined;
  const projectPublicId = params?.projectId as string | undefined;

  const displayName = user?.firstName
    ? user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName
    : (user?.email?.split("@")[0] ?? "");

  if (!orgId) return;

  const navList = projectPublicId
    ? generateProjectNav(orgId, projectPublicId)
    : generateOrgNav(orgId);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col bg-sidebar border-r border-sidebar-border"
      style={{ viewTransitionName: "console-sidebar" }}
      aria-label="Console navigation"
    >
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center px-5 border-b border-sidebar-border">
        <BrandLogo className="w-28" />
      </div>

      {/* Project display */}
      {projectPublicId && (
        <div className="shrink-0 pt-3 border-b border-sidebar-border">
          <ProjectDisplay />
        </div>
      )}

      {/* Nav — scrollable */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
        {projectPublicId && (
          <Link
            href={`/orgs/${orgId}`}
            className="flex items-center gap-1.5 px-3 py-2 mb-4 text-[12px] text-sidebar-foreground hover:text-sidebar-foreground transition-colors duration-100 rounded-lg hover:bg-sidebar-accent/70"
          >
            <ChevronLeft className="size-3.5 shrink-0" strokeWidth={1.75} />
            Organization
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
          <Menu.Root>
            <Menu.Trigger
              className={cn(
                "group w-full flex items-center gap-2.5 px-3 pb-3 pt-1",
                "cursor-pointer transition-colors duration-100",
                "hover:bg-sidebar-accent/60",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
                "data-[popup-open]:bg-sidebar-accent/60",
              )}
            >
              <UserAvatar
                profilePictureUrl={user.profilePictureUrl}
                firstName={user.firstName}
                lastName={user.lastName}
                email={user.email}
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[12px] font-medium text-sidebar-foreground truncate leading-tight">
                  {displayName}
                </p>
                <p className="font-mono text-[9px] tracking-wide text-sidebar-foreground truncate leading-tight mt-0.5">
                  {user.email}
                </p>
              </div>
              <ChevronUp
                className="size-3 shrink-0 text-sidebar-foreground transition-transform duration-150 group-data-[popup-open]:rotate-180"
                strokeWidth={1.75}
              />
            </Menu.Trigger>

            <Menu.Portal>
              <Menu.Positioner
                side="top"
                align="start"
                sideOffset={4}
                className="z-50 outline-none"
              >
                <Menu.Popup
                  className={cn(
                    "w-[204px] overflow-hidden",
                    "bg-sidebar border border-sidebar-border",
                    "shadow-[0_4px_16px_color-mix(in_srgb,var(--color-ink)_12%,transparent),0_1px_4px_color-mix(in_srgb,var(--color-ink)_8%,transparent)]",
                    "data-[starting-style]:opacity-0 data-[starting-style]:translate-y-1",
                    "data-[ending-style]:opacity-0 data-[ending-style]:translate-y-1",
                    "transition-[opacity,transform] duration-150 ease-out",
                  )}
                  style={{ borderRadius: "2px" }}
                >
                  {/* User info header */}
                  <div className="px-3 py-2.5 border-b border-sidebar-border">
                    <p className="text-[12px] font-medium text-sidebar-foreground truncate leading-tight">
                      {displayName}
                    </p>
                    <p className="font-mono text-[9px] tracking-wide text-sidebar-foreground truncate leading-tight mt-0.5">
                      {user.email}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="py-1">
                    <Menu.Item
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 text-[12px]",
                        "text-sidebar-foreground cursor-pointer select-none",
                        "transition-colors duration-100 outline-none",
                        "hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                        "data-[highlighted]:bg-sidebar-accent/70 data-[highlighted]:text-sidebar-foreground",
                        "focus-visible:bg-sidebar-accent/70",
                      )}
                      onClick={() => signOutAction()}
                    >
                      <LogOut
                        className="size-3.5 shrink-0 opacity-60"
                        strokeWidth={1.75}
                      />
                      Sign out
                    </Menu.Item>
                  </div>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </div>
    </aside>
  );
}
