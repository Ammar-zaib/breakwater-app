import { auth } from "@/auth";
import { db } from "@/db";
import { accounts, users, teamMembers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/** The signed-in user's row, or null. Throws is avoided so callers (server
 * actions, route handlers) can decide how to respond to "not signed in". */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) return null;

  // A pending team invite (sent to this email before they'd ever signed in)
  // becomes usable the moment they sign in — link it here rather than
  // requiring a separate "accept invite" click.
  if (user.email) {
    await db
      .update(teamMembers)
      .set({ memberUserId: user.id, acceptedAt: new Date() })
      .where(and(eq(teamMembers.memberEmail, user.email), isNull(teamMembers.memberUserId)));
  }

  return user;
}

/** The GitHub access token stored for this user's GitHub OAuth account. */
export async function getGitHubToken(userId: string): Promise<string | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")));
  return account?.access_token ?? null;
}
