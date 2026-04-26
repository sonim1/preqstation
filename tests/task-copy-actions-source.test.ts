import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sourcePath = path.join(process.cwd(), 'app', 'components', 'task-copy-actions.tsx');
const source = readFileSync(sourcePath, 'utf8');

describe('task-copy-actions source', () => {
  it('syncs the keyboard dispatch ref before paint instead of in a passive effect', () => {
    expect(source).toContain('sendDispatchRef.current = sendDispatch;');
    expect(source).toContain('useLayoutEffect(() => {');
    expect(source).not.toContain(
      "useEffect(() => {\n    sendDispatchRef.current = sendDispatch;\n  });",
    );
  });

  it('calls the current send handler directly from the send button', () => {
    expect(source).toContain('void sendDispatch();');
    expect(source.match(/sendDispatchRef\.current\?\.\(\)/g)).toHaveLength(1);
  });
});
