"use client";

/**
 * OrgSwitcherWidget — wraps the WorkOS <OrganizationSwitcher /> widget.
 *
 * Fetches a short-lived widget token from our backend API on demand and passes
 * it as the `authToken` prop (lazy-fetch pattern — the widget calls our function
 * only when it needs a fresh token).
 *
 * On selection the widget calls AuthKit's `switchToOrganization`, then navigates
 * to the selected org's detail page via Next navigation.
 */

import { OrganizationSwitcher, WorkOsWidgets } from "@workos-inc/widgets";
import { DEV_BYPASS_AUTH } from "../../env";
import { useAccessToken, useAuth } from "@workos-inc/authkit-nextjs/components";
import { useLocation } from "@/lib/navigation";

export function OrgSwitcherWidget() {
  const { switchToOrganization } = useAuth();
  const { accessToken } = useAccessToken();
  const { href } = useLocation();

  const switchToOrg = async (params: { organizationId: string }) => {
    await switchToOrganization(params.organizationId, {
      returnTo: href,
    });
  };

  // In dev-bypass mode user.id is not a real WorkOS ID — the widget token
  // endpoint would fail. Render a static placeholder instead.
  if (DEV_BYPASS_AUTH) {
    return (
      <div
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          background: "var(--color-muted, #f3f4f6)",
          fontSize: 13,
          color: "var(--color-muted-foreground, #6b7280)",
          cursor: "default",
          userSelect: "none",
        }}
      >
        Dev Org (bypass)
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          background: "var(--color-muted, #f3f4f6)",
          fontSize: 13,
          color: "var(--color-muted-foreground, #6b7280)",
          cursor: "default",
          userSelect: "none",
        }}
      >
        Org switcher unavailable
      </div>
    );
  }

  return (
    <WorkOsWidgets>
      <OrganizationSwitcher
        key={accessToken}
        authToken={accessToken}
        variant="ghost"
        switchToOrganization={switchToOrg}
      />
    </WorkOsWidgets>
  );
}
