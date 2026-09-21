import { cookies } from "next/headers";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAccessibleAccounts, type AccessRole } from "@/lib/access";

export const ACTIVE_WORKSPACE_COOKIE = "bw_workspace";

export type WorkspaceOption = { ownerId: string; role: AccessRole; label: string };

/** Every account this user can switch into, labeled for the sidebar switcher. */
export async function getWorkspaceOptions(userId: string): Promise<WorkspaceOption[]> {
  const accounts = await getAccessibleAccounts(userId);
  const otherOwnerIds = accounts.map((a) => a.ownerId).filter((id) => id !== userId);
  const owners = otherOwnerIds.length
    ? await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, otherOwnerIds))
    : [];
  const emailById = new Map(owners.map((o) => [o.id, o.email]));

  return accounts.map((a) => ({
    ownerId: a.ownerId,
    role: a.role,
    label: a.ownerId === userId ? "My account" : (emailById.get(a.ownerId) ?? "Shared account"),
  }));
}

/**
 * Which account's data the dashboard should show right now. A user always
 * has at least their own account ("owner" role); if they're also on
 * someone else's team, a cookie remembers which one they last picked. Falls
 * back to their own account if the cookie is missing, or points at an
 * account they no longer have access to.
 */
export async function getActiveWorkspace(userId: string) {
  const accounts = await getAccessibleAccounts(userId);
  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const match = requested ? accounts.find((a) => a.ownerId === requested) : undefined;
  return match ?? accounts.find((a) => a.ownerId === userId)!;
}
