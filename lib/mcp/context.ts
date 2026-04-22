import type { PreqEngine } from '@/lib/mcp/connections';

export type McpAuthContext = {
  userId: string;
  userEmail: string;
  connectionId: string;
  onDetectedClientEngine?: (engine: PreqEngine) => void | Promise<void>;
};
