import { and, desc, eq } from 'drizzle-orm';

import { withAdminDb, withOwnerDb } from '@/lib/db/rls';
import { mcpConnections, oauthClients } from '@/lib/db/schema';

export const PREQ_ENGINES = ['claude-code', 'codex', 'gemini-cli'] as const;
export type PreqEngine = (typeof PREQ_ENGINES)[number];

function normalizeClientName(clientName?: string | null) {
  const normalized = (clientName || '').trim();
  return normalized || null;
}

export function getOAuthClientDisplayName(input: {
  clientName?: string | null;
  redirectUri: string;
}) {
  const clientName = normalizeClientName(input.clientName);
  if (clientName) return clientName;

  try {
    return new URL(input.redirectUri).hostname;
  } catch {
    return input.redirectUri;
  }
}

export async function registerOAuthClient(input: {
  clientName?: string | null;
  redirectUris: string[];
}) {
  return withAdminDb(async (client) => {
    const clientId = crypto.randomUUID();
    const [record] = await client
      .insert(oauthClients)
      .values({
        clientId,
        clientName: normalizeClientName(input.clientName),
        redirectUris: input.redirectUris,
      })
      .returning({
        clientId: oauthClients.clientId,
        ownerId: oauthClients.ownerId,
        clientName: oauthClients.clientName,
        redirectUris: oauthClients.redirectUris,
      });

    return record;
  });
}

export async function getOAuthClientById(clientId: string) {
  return withAdminDb((client) =>
    client.query.oauthClients.findFirst({
      where: eq(oauthClients.clientId, clientId),
      columns: {
        clientId: true,
        ownerId: true,
        clientName: true,
        redirectUris: true,
      },
    }),
  );
}

export async function assignOAuthClientOwner(input: { clientId: string; ownerId: string }) {
  return withAdminDb(async (client) => {
    const record = await client.query.oauthClients.findFirst({
      where: eq(oauthClients.clientId, input.clientId),
      columns: {
        clientId: true,
        ownerId: true,
        clientName: true,
        redirectUris: true,
      },
    });

    if (!record) return null;
    if (record.ownerId && record.ownerId !== input.ownerId) return null;
    if (record.ownerId === input.ownerId) return record;

    const [updated] = await client
      .update(oauthClients)
      .set({ ownerId: input.ownerId })
      .where(eq(oauthClients.clientId, input.clientId))
      .returning({
        clientId: oauthClients.clientId,
        ownerId: oauthClients.ownerId,
        clientName: oauthClients.clientName,
        redirectUris: oauthClients.redirectUris,
      });

    return updated ?? null;
  });
}

export async function createOrRefreshMcpConnection(input: {
  ownerId: string;
  clientId: string;
  clientName?: string | null;
  redirectUri: string;
  expiresAt: Date;
  engine?: PreqEngine | null;
}) {
  return withOwnerDb(input.ownerId, async (client) => {
    const existing = await client.query.mcpConnections.findFirst({
      where: and(
        eq(mcpConnections.ownerId, input.ownerId),
        eq(mcpConnections.clientId, input.clientId),
      ),
      columns: {
        id: true,
      },
    });

    const values = {
      displayName: getOAuthClientDisplayName({
        clientName: input.clientName,
        redirectUri: input.redirectUri,
      }),
      redirectUri: input.redirectUri,
      expiresAt: input.expiresAt,
      revokedAt: null,
      ...(input.engine ? { engine: input.engine } : {}),
    };

    if (existing) {
      const [updated] = await client
        .update(mcpConnections)
        .set(values)
        .where(eq(mcpConnections.id, existing.id))
        .returning({
          id: mcpConnections.id,
          expiresAt: mcpConnections.expiresAt,
        });

      return updated;
    }

    const [created] = await client
      .insert(mcpConnections)
      .values({
        ownerId: input.ownerId,
        clientId: input.clientId,
        displayName: values.displayName,
        redirectUri: values.redirectUri,
        engine: input.engine ?? null,
        expiresAt: input.expiresAt,
      })
      .returning({
        id: mcpConnections.id,
        expiresAt: mcpConnections.expiresAt,
      });

    return created;
  });
}

export async function getMcpConnectionById(connectionId: string) {
  return withAdminDb((client) =>
    client.query.mcpConnections.findFirst({
      where: eq(mcpConnections.id, connectionId),
      columns: {
        id: true,
        ownerId: true,
        clientId: true,
        displayName: true,
        redirectUri: true,
        engine: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        client: {
          columns: {
            clientName: true,
          },
        },
      },
    }),
  );
}

export async function touchMcpConnectionLastUsed(connectionId: string, lastUsedAt: Date) {
  return withAdminDb(async (client) => {
    await client
      .update(mcpConnections)
      .set({ lastUsedAt })
      .where(eq(mcpConnections.id, connectionId));
  });
}

export async function updateMcpConnectionEngine(connectionId: string, engine: PreqEngine) {
  return withAdminDb(async (client) => {
    await client.update(mcpConnections).set({ engine }).where(eq(mcpConnections.id, connectionId));
  });
}

export async function listOwnerMcpConnections(ownerId: string) {
  return withOwnerDb(ownerId, (client) =>
    client.query.mcpConnections.findMany({
      where: eq(mcpConnections.ownerId, ownerId),
      columns: {
        id: true,
        clientId: true,
        displayName: true,
        redirectUri: true,
        engine: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
      with: {
        client: {
          columns: {
            clientName: true,
          },
        },
      },
      orderBy: [desc(mcpConnections.createdAt)],
    }),
  );
}

export async function setMcpConnectionRevokedState(input: {
  ownerId: string;
  connectionId: string;
  revoked: boolean;
}) {
  return withOwnerDb(input.ownerId, async (client) => {
    const [updated] = await client
      .update(mcpConnections)
      .set({ revokedAt: input.revoked ? new Date() : null })
      .where(
        and(eq(mcpConnections.id, input.connectionId), eq(mcpConnections.ownerId, input.ownerId)),
      )
      .returning({ id: mcpConnections.id });

    return updated ?? null;
  });
}
