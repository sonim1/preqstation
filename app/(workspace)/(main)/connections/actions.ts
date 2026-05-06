'use server';

import { revalidatePath } from 'next/cache';

import { writeAuditLog } from '@/lib/audit';
import { revokeActiveOwnerBrowserSessions, revokeBrowserSession } from '@/lib/browser-sessions';
import {
  revokeActiveOwnerMcpConnections,
  setMcpConnectionRevokedState,
} from '@/lib/mcp/connections';
import { requireOwnerUser } from '@/lib/owner';

async function updateConnectionRevokedState(formData: FormData, revoked: boolean): Promise<void> {
  try {
    const owner = await requireOwnerUser();
    const connectionId = String(formData.get('connectionId') || '').trim();
    if (!connectionId) {
      return;
    }

    const updated = await setMcpConnectionRevokedState({
      ownerId: owner.id,
      connectionId,
      revoked,
    });
    if (!updated) {
      return;
    }

    await writeAuditLog({
      ownerId: owner.id,
      action: revoked ? 'mcp_connection.revoked' : 'mcp_connection.restored',
      targetType: 'mcp_connection',
      targetId: connectionId,
    });

    revalidatePath('/connections');
    revalidatePath('/api-keys');
  } catch (error) {
    if (error instanceof Response) return;
    return;
  }
}

export async function revokeConnectionAction(formData: FormData) {
  return updateConnectionRevokedState(formData, true);
}

export async function revokeAllConnectionsAction() {
  try {
    const owner = await requireOwnerUser();
    const revoked = await revokeActiveOwnerMcpConnections({ ownerId: owner.id });
    if (revoked.length === 0) {
      return;
    }

    await writeAuditLog({
      ownerId: owner.id,
      action: 'mcp_connections.revoked_all',
      targetType: 'mcp_connection',
      meta: { count: revoked.length },
    });

    revalidatePath('/connections');
    revalidatePath('/api-keys');
  } catch (error) {
    if (error instanceof Response) return;
    return;
  }
}

export async function restoreConnectionAction(formData: FormData) {
  return updateConnectionRevokedState(formData, false);
}

export async function revokeAllBrowserSessionsAction() {
  try {
    const owner = await requireOwnerUser();
    const revoked = await revokeActiveOwnerBrowserSessions({ ownerId: owner.id });
    if (revoked.length === 0) {
      return;
    }

    await writeAuditLog({
      ownerId: owner.id,
      action: 'browser_sessions.revoked_all',
      targetType: 'browser_session',
      meta: { count: revoked.length },
    });

    revalidatePath('/connections');
  } catch (error) {
    if (error instanceof Response) return;
    return;
  }
}

export async function revokeBrowserSessionAction(formData: FormData) {
  try {
    const owner = await requireOwnerUser();
    const sessionId = String(formData.get('sessionId') || '').trim();
    if (!sessionId) {
      return;
    }

    const revoked = await revokeBrowserSession({
      ownerId: owner.id,
      sessionId,
    });
    if (!revoked) {
      return;
    }

    await writeAuditLog({
      ownerId: owner.id,
      action: 'browser_session.revoked',
      targetType: 'browser_session',
      targetId: sessionId,
    });

    revalidatePath('/connections');
  } catch (error) {
    if (error instanceof Response) return;
    return;
  }
}
