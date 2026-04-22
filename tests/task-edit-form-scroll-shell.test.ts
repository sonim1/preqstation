import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const taskPanelModalCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-panel-modal.module.css'),
  'utf8',
);
const taskEditFormCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-edit-form.module.css'),
  'utf8',
);
const globalCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

function getRuleBody(css: string, selector: string) {
  const selectorPattern = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\}`, 'm'));

  expect(match, `Expected CSS rule for ${selector}`).toBeTruthy();

  return match?.[1] ?? '';
}

describe('task edit modal scroll-shell CSS regressions', () => {
  it('keeps the desktop modal shell fixed while the body owns overflow', () => {
    const contentRule = getRuleBody(taskPanelModalCss, '.content');
    const titleRowRule = getRuleBody(taskPanelModalCss, '.titleRow');
    const titleCenterRule = getRuleBody(taskPanelModalCss, '.titleCenter');
    const bodyRule = getRuleBody(taskPanelModalCss, '.body');

    expect(contentRule).toContain('display: flex;');
    expect(contentRule).toContain('flex-direction: column;');
    expect(contentRule).toContain('max-height:');
    expect(contentRule).toContain('min-height: min(calc(100dvh - 3rem), 52rem);');
    expect(contentRule).toContain('overflow: hidden;');
    expect(titleRowRule).toContain('position: relative;');
    expect(titleCenterRule).toContain('position: absolute;');
    expect(titleCenterRule).toContain('left: 50%;');
    expect(titleCenterRule).toContain('transform: translateX(-50%);');

    expect(bodyRule).toContain('flex: 1 1 0;');
    expect(bodyRule).toContain('min-height: 0;');
    expect(bodyRule).toContain('overflow-y: auto;');
    expect(bodyRule).toContain('overflow-x: hidden;');
  });

  it('hides the centered header save state on mobile', () => {
    expect(taskPanelModalCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.titleCenter\s*\{[\s\S]*display:\s*none;/,
    );
  });

  it('builds the desktop edit form as a two-column workbench with dispatch above task settings', () => {
    const shellRule = getRuleBody(taskEditFormCss, '.shell');
    const sidebarRule = getRuleBody(taskEditFormCss, '.sidebar');
    const mainColumnRule = getRuleBody(taskEditFormCss, '.mainColumn');
    const dispatchRailRule = getRuleBody(taskEditFormCss, '.dispatchRail');
    const sectionSurfaceRule = getRuleBody(taskEditFormCss, '.sectionSurface');
    const metadataSectionRule = getRuleBody(taskEditFormCss, '.metadataSection');
    const notesCardRule = getRuleBody(taskEditFormCss, '.notesCard');
    const activityCardRule = getRuleBody(taskEditFormCss, '.activityCard');
    const notesEditorRule = getRuleBody(taskEditFormCss, '.notesEditor');
    const dispatchLabelRule = getRuleBody(
      globalCss,
      '.task-dispatch-actions .openclaw-dispatch-label',
    );
    const dispatchTitleRule = getRuleBody(
      globalCss,
      '.task-dispatch-actions .openclaw-actions-label',
    );

    expect(shellRule).toContain('--task-edit-section-min-height: clamp(30rem, 62vh, 44rem);');
    expect(shellRule).toContain('grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem);');
    expect(sidebarRule).toContain('display: grid;');
    expect(sidebarRule).toContain('align-content: start;');
    expect(mainColumnRule).toContain('display: grid;');
    expect(mainColumnRule).toContain('grid-template-rows: minmax(0, 1fr) auto;');
    expect(mainColumnRule).toContain('min-height: 0;');
    expect(dispatchRailRule).toContain('display: grid;');
    expect(dispatchRailRule).toContain('align-content: start;');
    expect(dispatchRailRule).not.toContain('min-height: var(--task-edit-section-min-height);');
    expect(dispatchRailRule).not.toContain('border-left:');
    expect(dispatchRailRule).not.toContain('padding-left:');
    expect(sectionSurfaceRule).not.toContain('min-height: var(--task-edit-section-min-height);');
    expect(sectionSurfaceRule).toContain('padding: clamp(0.875rem, 1.4vw, 1rem);');
    expect(sectionSurfaceRule).not.toContain('border:');
    expect(sectionSurfaceRule).not.toContain('border-radius:');
    expect(sectionSurfaceRule).not.toContain('background:');
    expect(dispatchLabelRule).toContain('justify-content: flex-start;');
    expect(dispatchTitleRule).toContain('color: var(--mantine-color-text);');
    expect(metadataSectionRule).toContain('display: block;');
    expect(notesCardRule).toContain('display: flex;');
    expect(notesCardRule).toContain('min-height: var(--task-edit-section-min-height);');
    expect(activityCardRule).toContain('padding: 0;');
    expect(notesEditorRule).toContain('display: flex;');
    expect(notesEditorRule).toContain('flex: 1 1 auto;');
    expect(notesEditorRule).toContain('flex-direction: column;');
    expect(taskEditFormCss).toMatch(/\.shell\s*\{[\s\S]*min-height:\s*0;/);
    expect(taskEditFormCss).toMatch(
      /\.notesEditor :global\(\.live-markdown-editor\)\s*\{[\s\S]*flex:\s*1 1 auto;/,
    );
    expect(taskEditFormCss).toMatch(
      /\.notesEditor :global\(\.live-editor-shell\)\s*\{[\s\S]*display:\s*flex;/,
    );
    expect(taskEditFormCss).toMatch(/@media \(max-width: 62em\)\s*\{[\s\S]*\.shell\s*\{/);
    expect(taskEditFormCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.dispatchRail[\s\S]*padding:\s*0;/,
    );
    expect(taskEditFormCss).not.toContain('.shellWithoutDispatch');
  });

  it('positions the mobile saving overlay over the form body and only reveals it on mobile', () => {
    const rootRule = getRuleBody(taskEditFormCss, '.root');
    const mobileSavingOverlayRule = getRuleBody(taskEditFormCss, '.mobileSavingOverlay');
    const mobileSavingOverlayCardRule = getRuleBody(taskEditFormCss, '.mobileSavingOverlayCard');

    expect(rootRule).toContain('position: relative;');
    expect(mobileSavingOverlayRule).toContain('position: absolute;');
    expect(mobileSavingOverlayRule).toContain('inset: 0;');
    expect(mobileSavingOverlayRule).toContain('display: none;');
    expect(mobileSavingOverlayCardRule).toContain('display: inline-flex;');
    expect(mobileSavingOverlayCardRule).toContain('align-items: center;');
    expect(taskEditFormCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.mobileSavingOverlay\s*\{[\s\S]*display:\s*flex;/,
    );
  });

  it('renders task settings as a compact card inside the metadata rail', () => {
    const metaHeaderRule = getRuleBody(taskEditFormCss, '.metaHeader');
    const settingsPanelRule = getRuleBody(taskEditFormCss, '.settingsPanel');
    const settingsDividerRule = getRuleBody(taskEditFormCss, '.settingsDivider');

    expect(metaHeaderRule).toContain('display: grid;');
    expect(metaHeaderRule).toContain('gap:');
    expect(metaHeaderRule).toContain('padding: 0;');
    expect(settingsPanelRule).toContain('gap: 0.875rem;');
    expect(settingsPanelRule).toContain(
      'border: 1px solid color-mix(in srgb, var(--ui-border), transparent 18%);',
    );
    expect(settingsPanelRule).toContain('border-radius: 8px;');
    expect(settingsPanelRule).toContain('padding: 0.875rem;');
    expect(settingsPanelRule).toContain(
      'background: color-mix(in srgb, var(--ui-surface-strong), transparent 48%);',
    );
    expect(settingsDividerRule).toContain(
      'border-top: 1px solid color-mix(in srgb, var(--ui-border), transparent 20%);',
    );
    expect(taskEditFormCss).not.toContain('box-shadow: var(--ui-elevation-1);');
  });

  it('keeps the task dispatch composer flat with segmented choices and a single send action', () => {
    const openclawActionsRule = getRuleBody(globalCss, '.openclaw-actions');
    const taskDispatchPanelRule = getRuleBody(globalCss, '.task-dispatch-panel');
    const taskDispatchFieldRule = getRuleBody(globalCss, '.task-dispatch-field');
    const taskDispatchSegmentedControlRule = getRuleBody(
      globalCss,
      '.task-dispatch-segmented-control',
    );
    const taskDispatchSelectedSegmentRule = getRuleBody(
      globalCss,
      ".task-dispatch-segment[data-selected='true']",
    );
    const taskDispatchControlIndicatorRule = getRuleBody(
      globalCss,
      '.task-dispatch-segmented-control::before',
    );
    const taskDispatchFocusedSegmentRule = getRuleBody(
      globalCss,
      '.task-dispatch-segment:focus-visible',
    );
    const taskDispatchEngineIconRule = getRuleBody(globalCss, '.task-dispatch-engine-icon');
    const taskDispatchTargetEmojiRule = getRuleBody(globalCss, '.task-dispatch-target-emoji');
    const taskDispatchTargetLogoRule = getRuleBody(globalCss, '.task-dispatch-target-logo');
    const taskDispatchPromptRule = getRuleBody(globalCss, '.task-dispatch-prompt');
    const taskDispatchCopyRule = getRuleBody(globalCss, '.task-dispatch-copy');
    const taskDispatchSendRule = getRuleBody(globalCss, '.task-dispatch-send');

    expect(globalCss).not.toContain('.task-edit-meta-actions');
    expect(openclawActionsRule).toContain('display: flex;');
    expect(openclawActionsRule).toContain('width: 100%;');
    expect(getRuleBody(globalCss, '.task-dispatch-actions')).toContain('display: grid;');
    expect(taskDispatchPanelRule).toContain('display: grid;');
    expect(taskDispatchPanelRule).toContain('gap: 0.625rem;');
    expect(taskDispatchFieldRule).toContain('grid-template-columns: 4.25rem minmax(0, 1fr);');
    expect(taskDispatchSegmentedControlRule).toContain(
      'grid-template-columns: repeat(3, minmax(0, 1fr));',
    );
    expect(taskDispatchSegmentedControlRule).not.toContain('overflow: hidden;');
    expect(globalCss).toMatch(
      /\.task-dispatch-segmented-control\[data-option-count='2'\]\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
    );
    expect(taskDispatchSelectedSegmentRule).toContain('color: var(--ui-text);');
    expect(taskDispatchControlIndicatorRule).toContain("content: '';");
    expect(taskDispatchControlIndicatorRule).toContain(
      'background: color-mix(in srgb, var(--ui-accent-soft), var(--ui-surface-strong) 42%);',
    );
    expect(taskDispatchControlIndicatorRule).toContain('box-shadow: inset 0 0 0 1px');
    expect(taskDispatchControlIndicatorRule).toContain(
      'transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1);',
    );
    expect(taskDispatchFocusedSegmentRule).toContain('z-index: 2;');
    expect(taskDispatchFocusedSegmentRule).toContain('outline-offset: 2px;');
    expect(globalCss).toMatch(
      /\.task-dispatch-segmented-control\[data-selected-index='2'\]::before\s*\{[\s\S]*transform:\s*translateX\(calc\(200% \+ 4px\)\);/,
    );
    expect(globalCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\.task-dispatch-segmented-control::before\s*\{[\s\S]*transition:\s*none;/,
    );
    expect(taskDispatchEngineIconRule).toContain('background: var(--engine-color);');
    expect(taskDispatchEngineIconRule).toContain(
      '-webkit-mask: var(--engine-icon) center / contain no-repeat;',
    );
    expect(taskDispatchEngineIconRule).toContain(
      'mask: var(--engine-icon) center / contain no-repeat;',
    );
    expect(taskDispatchTargetEmojiRule).toContain('display: inline-grid;');
    expect(taskDispatchTargetEmojiRule).toContain('place-items: center;');
    expect(taskDispatchTargetEmojiRule).toContain('width: 1rem;');
    expect(taskDispatchTargetEmojiRule).toContain('height: 1rem;');
    expect(taskDispatchTargetEmojiRule).toContain('flex-shrink: 0;');
    expect(taskDispatchTargetEmojiRule).toContain('line-height: 1;');
    expect(taskDispatchTargetLogoRule).toContain('display: block;');
    expect(taskDispatchTargetLogoRule).toContain('width: 1rem;');
    expect(taskDispatchTargetLogoRule).toContain('height: 1rem;');
    expect(taskDispatchTargetLogoRule).toContain('flex-shrink: 0;');
    expect(taskDispatchTargetLogoRule).toContain('object-fit: contain;');
    expect(taskDispatchPromptRule).toContain('min-height: 6.25rem;');
    expect(taskDispatchPromptRule).toContain('max-height: 14rem;');
    expect(taskDispatchPromptRule).toContain('overflow: auto;');
    expect(taskDispatchPromptRule).toContain('padding: 0.75rem 4.5rem 0.75rem 0.75rem;');
    expect(taskDispatchPromptRule).toContain('user-select: text;');
    expect(taskDispatchPromptRule).toContain('white-space: pre-wrap;');
    expect(taskDispatchPromptRule).toContain('overflow-wrap: anywhere;');
    expect(taskDispatchCopyRule).toContain('position: absolute;');
    expect(taskDispatchCopyRule).toContain('opacity: 0;');
    expect(globalCss).toMatch(
      /\.task-dispatch-prompt-shell:hover \.task-dispatch-copy,\s*\.task-dispatch-prompt-shell:focus-within \.task-dispatch-copy\s*\{[\s\S]*opacity:\s*1;/,
    );
    expect(taskDispatchSendRule).toContain('width: 100%;');
    expect(taskDispatchSendRule).toContain('background: var(--ui-accent);');
  });

  it('keeps live markdown editing inline while preserving empty-list affordances', () => {
    const emptyListRule = getRuleBody(
      globalCss,
      ".live-editor-input [data-live-editor-empty='true']",
    );
    const emptyListLaneRule = getRuleBody(
      globalCss,
      ".live-editor-input [data-live-editor-empty='true']::after",
    );

    expect(globalCss).not.toContain('.live-editor-active-source');
    expect(globalCss).not.toContain("[data-live-editor-editing-source='true']");
    expect(globalCss).not.toContain(
      "[data-live-editor-heading-prefix][data-live-editor-active='true']::before",
    );
    expect(globalCss).toContain("[data-live-editor-heading-source='h3']");
    expect(globalCss).toContain('--live-editor-heading-marker-color:');
    expect(emptyListRule).toContain('min-height:');
    expect(emptyListRule).toContain('position: relative;');
    expect(emptyListLaneRule).toContain("content: '';");
    expect(emptyListLaneRule).toContain('border-radius:');
    expect(emptyListLaneRule).toContain('background:');
  });
});
