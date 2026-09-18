import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";

/**
 * Lightweight collaboration model: repos/scans/settings stay owned by a
 * single `userId` (see schema.ts comment on `teamMembers`). A team member
 * doesn't get their own copy of the data — they get a role on someone
 * else's account, resolved here, rather than every query in the app being
 * rewritten to understand multi-tenant ownership.
 */
export type AccessRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_RANK: Record<AccessRole, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export function roleAtLeast(role: AccessRole, min: AccessRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

function normalizeRole(role: string): AccessRole {
  return role === "admin" || role === "editor" || role === "viewer" ? role : "viewer";
}

/** Every account (by owner user id) this user can see, with their role on it.
 *  Always includes the user's own account with role "owner". */
export async function getAccessibleAccounts(
  userId: string
): Promise<{ ownerId: string; role: AccessRole }[]> {
  const memberships = await db
    .select({ ownerId: teamMembers.ownerId, role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.memberUserId, userId), isNotNull(teamMembers.acceptedAt)));

  return [
    { ownerId: userId, role: "owner" as const },
    ...memberships.map((m) => ({ ownerId: m.ownerId, role: normalizeRole(m.role) })),
  ];
}

/** Owner user ids whose data this user is allowed to see (their own + any account they've been invited into). */
export async function getOwnerIds(userId: string): Promise<string[]> {
  return (await getAccessibleAccounts(userId)).map((a) => a.ownerId);
}

/** This user's role on the given owner account, or null if they have no access at all. */
export async function getRoleForOwner(userId: string, ownerId: string): Promise<AccessRole | null> {
  if (userId === ownerId) return "owner";
  const accounts = await getAccessibleAccounts(userId);
  return accounts.find((a) => a.ownerId === ownerId)?.role ?? null;
}
