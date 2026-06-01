import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sourcePath = path.join(process.cwd(), 'app', 'components', 'task-panel-modal.tsx');
const source = readFileSync(sourcePath, 'utf8');

function getSourceBetween(haystack: string, startNeedle: string, endNeedle: string) {
  const start = haystack.indexOf(startNeedle);
  const end = haystack.indexOf(endNeedle, start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return haystack.slice(start, end);
}

describe('task-panel-modal source', () => {
  it('only sets drag state when a header drag first becomes active', () => {
    const pointerMoveSource = getSourceBetween(
      source,
      'const handlePointerMove = (pointerEvent: PointerEvent) => {',
      '    const handlePointerEnd = (pointerEvent: PointerEvent) => {',
    );
    const dragActivationSource = getSourceBetween(
      pointerMoveSource,
      'if (!hasActiveDragRef.current) {',
      '      pointerEvent.preventDefault();',
    );

    expect(dragActivationSource).toContain("setOffsetSource('drag');");
    expect(dragActivationSource).toContain('setIsPanelDragging(true);');
    expect(pointerMoveSource).not.toContain(
      "hasActiveDragRef.current = true;\n      pointerEvent.preventDefault();\n      setOffsetSource('drag');\n      setIsPanelDragging(true);",
    );
  });

  it('does not update React offset source state during resize ticks', () => {
    const resizeTickSource = getSourceBetween(
      source,
      'onResize={(_event, direction, ref, delta) => {',
      '          onResizeStop={handleResizeStop}',
    );

    expect(resizeTickSource).not.toContain('setOffsetSource');
  });
});
