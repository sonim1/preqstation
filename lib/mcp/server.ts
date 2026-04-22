import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { PreqEngine } from '@/lib/mcp/connections';
import type { McpAuthContext } from '@/lib/mcp/context';
import { registerPreqTools } from '@/lib/mcp/tools';

function inferEngineFromClientInfo(clientInfo: unknown): PreqEngine | null {
  const rawName =
    typeof (clientInfo as { name?: unknown })?.name === 'string'
      ? ((clientInfo as { name?: string }).name ?? '')
      : '';
  const name = rawName.trim().toLowerCase();
  if (!name) return null;
  if (name.includes('claude')) return 'claude-code';
  if (name.includes('gemini')) return 'gemini-cli';
  if (name.includes('codex') || name.includes('openai') || name.includes('chatgpt')) return 'codex';
  return null;
}

export function createPreqMcpServer(context: McpAuthContext) {
  const server = new McpServer({
    name: 'preqstation-mcp',
    version: '1.0.0',
  });

  let detectedClientEngine: PreqEngine | null = null;
  server.server.oninitialized = () => {
    detectedClientEngine = inferEngineFromClientInfo(server.server.getClientVersion());
    if (detectedClientEngine && context.onDetectedClientEngine) {
      void context.onDetectedClientEngine(detectedClientEngine);
    }
  };

  registerPreqTools(server, {
    ...context,
    getDetectedClientEngine: () => detectedClientEngine,
  });

  return server;
}
