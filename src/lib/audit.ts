import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * One call, one row. `ownerId` is whose account the action happened under
 * (so it shows up in that account's log even when a team member did it);
 * `actor` is who actually did it. Never throws — an audit-log write failing
 * should never take down the action it's describing, so errors are logged
 * and swallowed rather than propagated.
 */
export async function logAudit(params: {
  ownerId: string;
  actor: { id: string; email: string | null };
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      ownerId: params.ownerId,
      actorUserId: params.actor.id,
      actorEmail: params.actor.email,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (e) {
    console.error(`[audit] failed to log "${params.action}" for owner ${params.ownerId}:`, e);
  }
}
