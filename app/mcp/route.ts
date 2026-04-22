import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { verifyMcpAccessToken } from '@/lib/mcp/auth';
import {
  getMcpConnectionById,
  touchMcpConnectionLastUsed,
  updateMcpConnectionEngine,
} from '@/lib/mcp/connections';
import { createPreqMcpServer } from '@/lib/mcp/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

function unauthorized() {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Bearer realm="preqstation"',
    },
  });
}

type McpAuthOutcome =
  | 'missing_token'
  | 'invalid_token'
  | 'connection_missing'
  | 'owner_mismatch'
  | 'revoked'
  | 'expired'
  | 'authorized';

type McpPayload = {
  method?: unknown;
  params?: {
    name?: unknown;
  };
};

type McpRequestSummary = {
  requestId: string;
  methods: string[];
  toolNames: string[];
  messageCount: number;
  payloadBytes: number;
};

type McpConnection = NonNullable<Awaited<ReturnType<typeof getMcpConnectionById>>>;

async function readMcpRequestSummary(request: Request): Promise<McpRequestSummary> {
  const requestId = crypto.randomUUID();
  const raw = await request.clone().text();
  const payloadBytes = new TextEncoder().encode(raw).byteLength;

  if (!raw.trim()) {
    return {
      requestId,
      methods: [],
      toolNames: [],
      messageCount: 0,
      payloadBytes,
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const messages = (Array.isArray(parsed) ? parsed : [parsed]) as McpPayload[];
    const methods = [
      ...new Set(
        messages.flatMap((message) => {
          if (typeof message?.method !== 'string') return [];
          return [message.method];
        }),
      ),
    ];
    const toolNames = [
      ...new Set(
        messages.flatMap((message) => {
          if (message?.method !== 'tools/call') return [];
          if (typeof message.params?.name !== 'string') return [];
          return [message.params.name];
        }),
      ),
    ];

    return {
      requestId,
      methods,
      toolNames,
      messageCount: messages.length,
      payloadBytes,
    };
  } catch {
    return {
      requestId,
      methods: [],
      toolNames: [],
      messageCount: 0,
      payloadBytes,
    };
  }
}

function logMcpRequestSummary(input: {
  request: Request;
  summary: McpRequestSummary;
  authOutcome: McpAuthOutcome;
  connection?: McpConnection | null;
  connectionId?: string | null;
}) {
  console.info('[mcp] request.summary', {
    requestId: input.summary.requestId,
    authOutcome: input.authOutcome,
    connectionId: input.connection?.id ?? input.connectionId ?? null,
    clientId: input.connection?.clientId ?? null,
    clientName: input.connection?.client?.clientName ?? input.connection?.displayName ?? null,
    methods: input.summary.methods,
    toolNames: input.summary.toolNames,
    messageCount: input.summary.messageCount,
    payloadBytes: input.summary.payloadBytes,
    ipAddress: getClientIp(input.request.headers),
    userAgent: input.request.headers.get('user-agent'),
    engineAtRequest: input.connection?.engine ?? null,
  });
}

function logMcpRequest(input: {
  request: Request;
  summary: McpRequestSummary;
  connection: McpConnection;
}) {
  const logKey = [
    'mcp-request',
    input.connection.id,
    input.summary.methods.join(',') || 'unknown-method',
    input.summary.toolNames.join(',') || 'no-tool',
  ].join(':');
  const rate = checkRateLimit(logKey, 1, 60_000);
  if (!rate.allowed) {
    return;
  }

  console.info('[mcp] request', {
    connectionId: input.connection.id,
    clientId: input.connection.clientId,
    clientName: input.connection.client?.clientName ?? input.connection.displayName ?? null,
    redirectUri: input.connection.redirectUri,
    engine: input.connection.engine ?? null,
    ipAddress: getClientIp(input.request.headers),
    userAgent: input.request.headers.get('user-agent'),
    methods: input.summary.methods,
    toolNames: input.summary.toolNames,
  });
}

export async function POST(request: Request) {
  const summary = await readMcpRequestSummary(request);
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token) {
    logMcpRequestSummary({ request, summary, authOutcome: 'missing_token' });
    return unauthorized();
  }

  const payload = await verifyMcpAccessToken(token);
  if (!payload) {
    logMcpRequestSummary({ request, summary, authOutcome: 'invalid_token' });
    return unauthorized();
  }
  const connection = await getMcpConnectionById(payload.connectionId);
  if (!connection) {
    logMcpRequestSummary({
      request,
      summary,
      authOutcome: 'connection_missing',
      connectionId: payload.connectionId,
    });
    return unauthorized();
  }
  if (connection.ownerId !== payload.sub) {
    logMcpRequestSummary({ request, summary, authOutcome: 'owner_mismatch', connection });
    return unauthorized();
  }
  if (connection.revokedAt) {
    logMcpRequestSummary({ request, summary, authOutcome: 'revoked', connection });
    return unauthorized();
  }
  if (connection.expiresAt.getTime() < Date.now()) {
    logMcpRequestSummary({ request, summary, authOutcome: 'expired', connection });
    return unauthorized();
  }

  logMcpRequestSummary({ request, summary, authOutcome: 'authorized', connection });
  logMcpRequest({ request, summary, connection });
  void touchMcpConnectionLastUsed(connection.id, new Date());

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const onDetectedClientEngine = (engine: 'claude-code' | 'codex' | 'gemini-cli') => {
    void updateMcpConnectionEngine(connection.id, engine);
    console.info('[mcp] engine.detected', {
      requestId: summary.requestId,
      connectionId: connection.id,
      clientId: connection.clientId,
      clientName: connection.client?.clientName ?? connection.displayName ?? null,
      detectedEngine: engine,
    });
  };
  const server = createPreqMcpServer({
    userId: payload.sub,
    userEmail: payload.email,
    connectionId: connection.id,
    onDetectedClientEngine,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
