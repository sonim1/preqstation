import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  getMcpConnectionById: vi.fn(),
  touchMcpConnectionLastUsed: vi.fn(),
  updateMcpConnectionEngine: vi.fn(),
  verifyMcpAccessToken: vi.fn(),
  createPreqMcpServer: vi.fn(),
  serverConnect: vi.fn(),
  handleRequest: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock('@/lib/mcp/auth', () => ({
  verifyMcpAccessToken: mocked.verifyMcpAccessToken,
}));

vi.mock('@/lib/mcp/connections', () => ({
  getMcpConnectionById: mocked.getMcpConnectionById,
  touchMcpConnectionLastUsed: mocked.touchMcpConnectionLastUsed,
  updateMcpConnectionEngine: mocked.updateMcpConnectionEngine,
}));

vi.mock('@/lib/mcp/server', () => ({
  createPreqMcpServer: mocked.createPreqMcpServer,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocked.checkRateLimit,
  getClientIp: mocked.getClientIp,
}));

vi.mock('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js', () => ({
  WebStandardStreamableHTTPServerTransport: class {
    handleRequest(request: Request) {
      return mocked.handleRequest(request);
    }
  },
}));

import { POST } from '@/app/mcp/route';

describe('app/mcp/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.verifyMcpAccessToken.mockResolvedValue(null);
    mocked.getMcpConnectionById.mockResolvedValue({
      id: 'connection-1',
      clientId: 'client-1',
      displayName: 'Codex',
      redirectUri: 'http://localhost:51205/callback',
      ownerId: 'owner-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      client: { clientName: 'Codex' },
    });
    mocked.touchMcpConnectionLastUsed.mockResolvedValue(undefined);
    mocked.updateMcpConnectionEngine.mockResolvedValue(undefined);
    mocked.serverConnect.mockResolvedValue(undefined);
    mocked.handleRequest.mockResolvedValue(new Response('ok', { status: 200 }));
    mocked.createPreqMcpServer.mockReturnValue({
      connect: mocked.serverConnect,
    });
    mocked.checkRateLimit.mockReturnValue({
      allowed: true,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    mocked.getClientIp.mockReturnValue('127.0.0.1');
  });

  it('returns 401 with a bearer challenge when no access token is present', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await POST(
      new Request(`${TEST_BASE_URL}/mcp`, {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer realm="preqstation"');
    expect(infoSpy).toHaveBeenCalledWith(
      '[mcp] request.summary',
      expect.objectContaining({
        requestId: expect.any(String),
        authOutcome: 'missing_token',
        messageCount: 0,
        payloadBytes: 0,
        methods: [],
        toolNames: [],
      }),
    );
    infoSpy.mockRestore();
  });

  it('returns 401 when the bearer token is invalid', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await POST(
      new Request(`${TEST_BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer realm="preqstation"');
    expect(infoSpy).toHaveBeenCalledWith(
      '[mcp] request.summary',
      expect.objectContaining({
        requestId: expect.any(String),
        authOutcome: 'invalid_token',
        messageCount: 0,
        payloadBytes: 0,
        methods: [],
        toolNames: [],
      }),
    );
    infoSpy.mockRestore();
  });

  it('creates a server and hands authenticated requests to the transport', async () => {
    mocked.verifyMcpAccessToken.mockResolvedValueOnce({
      sub: 'owner-1',
      email: 'owner@example.com',
      connectionId: 'connection-1',
      isOwner: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const request = new Request(`${TEST_BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocked.createPreqMcpServer).toHaveBeenCalledWith({
      userId: 'owner-1',
      userEmail: 'owner@example.com',
      connectionId: 'connection-1',
      onDetectedClientEngine: expect.any(Function),
    });
    expect(mocked.touchMcpConnectionLastUsed).toHaveBeenCalledWith(
      'connection-1',
      expect.any(Date),
    );
    expect(mocked.serverConnect).toHaveBeenCalledOnce();
    expect(mocked.handleRequest).toHaveBeenCalledWith(request);
  });

  it('logs the MCP client and tool name for authenticated tool calls', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocked.verifyMcpAccessToken.mockResolvedValueOnce({
      sub: 'owner-1',
      email: 'owner@example.com',
      connectionId: 'connection-1',
      isOwner: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const request = new Request(`${TEST_BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'application/json',
        'user-agent': 'Codex/1.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'preq_list_tasks' },
      }),
    });

    await POST(request);

    expect(infoSpy).toHaveBeenCalledWith(
      '[mcp] request.summary',
      expect.objectContaining({
        requestId: expect.any(String),
        authOutcome: 'authorized',
        methods: ['tools/call'],
        toolNames: ['preq_list_tasks'],
        messageCount: 1,
        payloadBytes: expect.any(Number),
        engineAtRequest: null,
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[mcp] request',
      expect.objectContaining({
        connectionId: 'connection-1',
        clientId: 'client-1',
        clientName: 'Codex',
        redirectUri: 'http://localhost:51205/callback',
        ipAddress: '127.0.0.1',
        userAgent: 'Codex/1.0',
        methods: ['tools/call'],
        toolNames: ['preq_list_tasks'],
      }),
    );

    infoSpy.mockRestore();
  });

  it('returns 401 when the stored connection has been revoked', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocked.verifyMcpAccessToken.mockResolvedValueOnce({
      sub: 'owner-1',
      email: 'owner@example.com',
      connectionId: 'connection-1',
      isOwner: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    mocked.getMcpConnectionById.mockResolvedValueOnce({
      id: 'connection-1',
      ownerId: 'owner-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await POST(
      new Request(`${TEST_BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer revoked-token',
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocked.createPreqMcpServer).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      '[mcp] request.summary',
      expect.objectContaining({
        requestId: expect.any(String),
        authOutcome: 'revoked',
        methods: [],
        toolNames: [],
      }),
    );
    infoSpy.mockRestore();
  });

  it('still logs request.summary when the sampled log is rate-limited', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocked.verifyMcpAccessToken.mockResolvedValueOnce({
      sub: 'owner-1',
      email: 'owner@example.com',
      connectionId: 'connection-1',
      isOwner: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    mocked.checkRateLimit.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    await POST(
      new Request(`${TEST_BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
          'user-agent': 'Codex/1.0',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'preq_list_tasks' },
        }),
      }),
    );

    expect(infoSpy).toHaveBeenCalledWith(
      '[mcp] request.summary',
      expect.objectContaining({ authOutcome: 'authorized' }),
    );
    infoSpy.mockRestore();
  });

  it('logs a follow-up engine.detected event from the existing callback', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocked.verifyMcpAccessToken.mockResolvedValueOnce({
      sub: 'owner-1',
      email: 'owner@example.com',
      connectionId: 'connection-1',
      isOwner: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await POST(
      new Request(`${TEST_BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
          'user-agent': 'Codex/1.0',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'preq_list_tasks' },
        }),
      }),
    );

    const onDetectedClientEngine =
      mocked.createPreqMcpServer.mock.calls[0][0].onDetectedClientEngine;
    await onDetectedClientEngine('codex');

    expect(mocked.updateMcpConnectionEngine).toHaveBeenCalledWith('connection-1', 'codex');
    expect(infoSpy).toHaveBeenCalledWith(
      '[mcp] engine.detected',
      expect.objectContaining({
        requestId: expect.any(String),
        connectionId: 'connection-1',
        detectedEngine: 'codex',
      }),
    );
    infoSpy.mockRestore();
  });
});
