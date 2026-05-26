import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const sourcePath = path.join(process.cwd(), 'app', 'components', 'task-copy-actions.tsx');
const source = readFileSync(sourcePath, 'utf8');
const globalsCssPath = path.join(process.cwd(), 'app', 'globals.css');
const globalsCss = readFileSync(globalsCssPath, 'utf8');

function getBottomPromptPopoverSource() {
  const popoverStart = source.indexOf('<Popover position="top-end"');
  const popoverEnd = source.indexOf('</Popover>', popoverStart);

  expect(popoverStart).toBeGreaterThanOrEqual(0);
  expect(popoverEnd).toBeGreaterThan(popoverStart);

  return source.slice(popoverStart, popoverEnd);
}

describe('task-copy-actions source', () => {
  it('syncs the keyboard dispatch ref before paint instead of in a passive effect', () => {
    expect(source).toContain('sendDispatchRef.current = sendDispatch;');
    expect(source).toContain('useLayoutEffect(() => {');
    expect(source).not.toContain(
      'useEffect(() => {\n    sendDispatchRef.current = sendDispatch;\n  });',
    );
  });

  it('calls the current send handler directly from the send button', () => {
    expect(source).toContain('void sendDispatch();');
    expect(source.match(/sendDispatchRef\.current\?\.\(\)/g)).toHaveLength(1);
  });

  it('keeps the Mod+Enter listener independent of dispatch state changes', () => {
    const keyboardEffectStart = source.indexOf('useEffect(() => {\n    const handleKeyDown');
    const keyboardEffectEnd = source.indexOf('  if (!hasDispatchControls)', keyboardEffectStart);
    expect(keyboardEffectStart).toBeGreaterThanOrEqual(0);
    expect(keyboardEffectEnd).toBeGreaterThan(keyboardEffectStart);
    const keyboardEffect = source.slice(keyboardEffectStart, keyboardEffectEnd);

    expect(keyboardEffect).not.toContain('isSending');
    expect(keyboardEffect).toContain('}, []);');
  });

  it('lets CSS control the bottom prompt popover width', () => {
    expect(getBottomPromptPopoverSource()).not.toContain('width={420}');
    expect(globalsCss).toContain('width: min(26rem, calc(100vw - 2rem));');
  });

  it('keeps the portaled bottom prompt copy action visible', () => {
    const visibleCopyRule = globalsCss.match(
      /\.task-dispatch-bottom-prompt-popover \.task-dispatch-copy\s*\{([^}]*)\}/,
    );

    expect(visibleCopyRule?.[1]).toContain('opacity: 1;');
    expect(visibleCopyRule?.[1]).toContain('transform: none;');
    expect(globalsCss).not.toMatch(
      /\.task-dispatch-bottom-prompt-field \.task-dispatch-copy\s*\{[^}]*opacity:\s*1;/,
    );
  });
});
