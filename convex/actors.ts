import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

type ConvexCtx = QueryCtx | MutationCtx;

function now() {
  return Date.now();
}

async function getUserByWorkosUserId(ctx: ConvexCtx, workosUserId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", workosUserId))
    .unique();
}

async function getUserByTokenIdentifier(
  ctx: ConvexCtx,
  tokenIdentifier: string,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.db
    .query("userAuthIdentities")
    .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();

  if (!identity) {
    return null;
  }

  return await ctx.db.get(identity.userId);
}

async function getOrganizationByWorkosOrgId(ctx: ConvexCtx, workosOrgId: string) {
  return await ctx.db
    .query("organizations")
    .withIndex("by_workos_org_id", (q) => q.eq("workosOrgId", workosOrgId))
    .unique();
}

async function ensureUserAuthIdentity(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    tokenIdentifier: string;
    issuer: string;
    subject: string;
  },
) {
  const existing = await ctx.db
    .query("userAuthIdentities")
    .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
    .unique();

  const timestamp = now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      userId: args.userId,
      issuer: args.issuer,
      subject: args.subject,
      lastSeenAt: timestamp,
    });
    return existing._id;
  }

  return await ctx.db.insert("userAuthIdentities", {
    userId: args.userId,
    tokenIdentifier: args.tokenIdentifier,
    issuer: args.issuer,
    subject: args.subject,
    createdAt: timestamp,
    lastSeenAt: timestamp,
  });
}

async function requireIdentity(ctx: ConvexCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized.");
  }
  return identity;
}

async function listOrganizationsForUser(ctx: ConvexCtx, userId: Id<"users">) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(100);

  const organizations = (
    await Promise.all(
      memberships.map(async (membership) => {
        const organization = await ctx.db.get(membership.organizationId);
        return organization
          ? {
              organization,
              membership,
            }
          : null;
      }),
    )
  ).filter(
    (
      value,
    ): value is {
      organization: Doc<"organizations">;
      membership: Doc<"memberships">;
    } => value !== null,
  );

  return organizations.map(({ organization, membership }) => ({
    id: organization._id,
    workosOrgId: organization.workosOrgId,
    name: organization.name,
    role: membership.role,
    joinedAt: membership.joinedAt,
  }));
}

export const bootstrapActorContext = mutation({
  args: {
    user: v.object({
      workosUserId: v.string(),
      email: v.optional(v.union(v.string(), v.null())),
      firstName: v.optional(v.union(v.string(), v.null())),
      lastName: v.optional(v.union(v.string(), v.null())),
    }),
    organization: v.union(
      v.null(),
      v.object({
        workosOrgId: v.string(),
        name: v.string(),
      }),
    ),
    defaultWorkosOrgId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const timestamp = now();

    let user =
      (await getUserByTokenIdentifier(ctx, identity.tokenIdentifier)) ??
      (await getUserByWorkosUserId(ctx, args.user.workosUserId));

    if (user) {
      await ctx.db.patch(user._id, {
        tokenIdentifier: identity.tokenIdentifier,
        workosUserId: args.user.workosUserId,
        email: args.user.email ?? undefined,
        firstName: args.user.firstName ?? undefined,
        lastName: args.user.lastName ?? undefined,
        defaultWorkosOrgId: args.defaultWorkosOrgId ?? undefined,
        updatedAt: timestamp,
      });
      user = (await ctx.db.get(user._id))!;
    } else {
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier,
        workosUserId: args.user.workosUserId,
        email: args.user.email ?? undefined,
        firstName: args.user.firstName ?? undefined,
        lastName: args.user.lastName ?? undefined,
        defaultWorkosOrgId: args.defaultWorkosOrgId ?? undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      user = (await ctx.db.get(userId))!;
    }

    await ensureUserAuthIdentity(ctx, {
      userId: user._id,
      tokenIdentifier: identity.tokenIdentifier,
      issuer: identity.issuer,
      subject: identity.subject,
    });

    let organizationDoc: Doc<"organizations"> | null = null;
    if (args.organization) {
      organizationDoc = await getOrganizationByWorkosOrgId(
        ctx,
        args.organization.workosOrgId,
      );

      if (organizationDoc) {
        await ctx.db.patch(organizationDoc._id, {
          name: args.organization.name,
          updatedAt: timestamp,
        });
        organizationDoc = (await ctx.db.get(organizationDoc._id))!;
      } else {
        const organizationId = await ctx.db.insert("organizations", {
          workosOrgId: args.organization.workosOrgId,
          name: args.organization.name,
          allocatedPlanId: "starter",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        organizationDoc = (await ctx.db.get(organizationId))!;
      }

      if (!organizationDoc) {
        throw new Error("Failed to provision organization.");
      }
      const organizationId = organizationDoc._id;

      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_organization_id_and_user_id", (q) =>
          q.eq("organizationId", organizationId).eq("userId", user._id),
        )
        .unique();

      if (!membership) {
        await ctx.db.insert("memberships", {
          organizationId,
          userId: user._id,
          role: "admin",
          joinedAt: timestamp,
        });
      }
    }

    const organizations = await listOrganizationsForUser(ctx, user._id);
    const activeWorkosOrgId =
      args.defaultWorkosOrgId ??
      args.organization?.workosOrgId ??
      user.defaultWorkosOrgId ??
      organizations[0]?.workosOrgId ??
      null;

    return {
      user: {
        id: user._id,
        workosUserId: user.workosUserId ?? args.user.workosUserId,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
      },
      activeWorkosOrgId,
      organizations,
    };
  },
});

export const getActorContext = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) {
      return {
        user: null,
        activeWorkosOrgId: null,
        organizations: [],
      };
    }

    const organizations = await listOrganizationsForUser(ctx, user._id);
    return {
      user: {
        id: user._id,
        workosUserId: user.workosUserId ?? null,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
      },
      activeWorkosOrgId: user.defaultWorkosOrgId ?? organizations[0]?.workosOrgId ?? null,
      organizations,
    };
  },
});
