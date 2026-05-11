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
const taskMetadataControlsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-metadata-controls.module.css'),
  'utf8',
);
const taskEditFormSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-edit-form.tsx'),
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
    const resizeHandleWrapperRule = getRuleBody(taskPanelModalCss, '.resizeHandleWrapper');
    const titleRowRule = getRuleBody(taskPanelModalCss, '.titleRow');
    const titleCenterRule = getRuleBody(taskPanelModalCss, '.titleCenter');
    const bodyRule = getRuleBody(taskPanelModalCss, '.body');

    expect(contentRule).toContain('display: flex;');
    expect(contentRule).toContain('flex-direction: column;');
    expect(contentRule).toContain('max-height:');
    expect(contentRule).toContain('min-height: min(calc(100dvh - 3rem), 52rem);');
    expect(contentRule).toContain('overflow: hidden;');
    expect(taskPanelModalCss).toMatch(
      /\.content\[data-resizable='true'\]\s*\{[^}]*flex-basis:\s*auto !important;/,
    );
    expect(taskPanelModalCss).not.toMatch(
      /\.content\[data-resizable='true'\]\s*>\s*div\s*\{[^}]*height:\s*100%;/,
    );
    expect(resizeHandleWrapperRule).toContain('position: absolute;');
    expect(resizeHandleWrapperRule).toContain('z-index: 1001;');
    expect(resizeHandleWrapperRule).toContain('pointer-events: none;');
    expect(taskPanelModalCss).toMatch(/\.resizeHandleTop\s*\{[\s\S]*top:\s*0 !important;/);
    expect(taskPanelModalCss).toMatch(/\.resizeHandleLeft\s*\{[\s\S]*left:\s*0 !important;/);
    expect(titleRowRule).toContain('display: grid;');
    expect(titleRowRule).toContain(
      'grid-template-columns: minmax(0, 1fr) minmax(0, max-content) auto;',
    );
    expect(titleRowRule).toContain('min-width: 0;');
    expect(getRuleBody(taskPanelModalCss, '.titleText')).toContain('overflow-wrap: anywhere;');
    expect(titleCenterRule).not.toContain('position: absolute;');
    expect(titleCenterRule).not.toContain('left: 50%;');
    expect(titleCenterRule).not.toContain('transform: translateX(-50%);');
    expect(titleCenterRule).toContain('min-width: 0;');
    expect(titleCenterRule).toContain('max-width: 100%;');
    expect(titleCenterRule).toContain('justify-self: center;');
    expect(getRuleBody(taskPanelModalCss, '.controls')).toContain('flex: 0 0 auto;');

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
    const notesContentRule = getRuleBody(taskEditFormCss, '.notesContent');
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
    expect(shellRule).toContain('grid-template-columns: minmax(0, 1fr) minmax(16rem, 20rem);');
    expect(shellRule).toContain('min-width: 0;');
    expect(shellRule).toContain('max-width: 100%;');
    expect(sidebarRule).toContain('display: grid;');
    expect(sidebarRule).toContain('align-content: start;');
    expect(sidebarRule).toContain('min-width: 0;');
    expect(mainColumnRule).toContain('display: grid;');
    expect(mainColumnRule).toContain('grid-template-rows: auto auto auto;');
    expect(mainColumnRule).toContain('align-content: start;');
    expect(mainColumnRule).toContain('max-width: 100%;');
    expect(mainColumnRule).toContain('height: fit-content;');
    expect(mainColumnRule).not.toContain('min-height: 0;');
    expect(mainColumnRule).toContain('min-width: 0;');
    expect(dispatchRailRule).toContain('display: grid;');
    expect(dispatchRailRule).toContain('align-content: start;');
    expect(dispatchRailRule).toContain('max-width: 100%;');
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
    expect(metadataSectionRule).toContain('max-width: 100%;');
    expect(notesCardRule).toContain('display: flex;');
    expect(notesCardRule).toContain('min-height: var(--task-edit-section-min-height);');
    expect(notesCardRule).toContain('max-width: 100%;');
    expect(activityCardRule).not.toContain('padding:');
    expect(activityCardRule).toContain('max-width: 100%;');
    expect(activityCardRule).toContain('min-height: auto;');
    expect(activityCardRule).toContain('overflow-wrap: anywhere;');
    expect(taskEditFormSource).toMatch(
      /className=\{`\$\{classes\.activityCard\} \$\{classes\.sectionSurface\}`\}[\s\S]*data-panel="task-edit-comments"/,
    );
    expect(taskEditFormSource).toMatch(
      /className=\{`\$\{classes\.activityCard\} \$\{classes\.sectionSurface\}`\}[\s\S]*data-panel="task-edit-activity"/,
    );
    expect(getRuleBody(taskEditFormCss, '.commentCard')).toContain('overflow-wrap: anywhere;');
    expect(notesContentRule).toContain('display: flex;');
    expect(notesContentRule).toContain('flex: 1 1 auto;');
    expect(notesContentRule).toContain('flex-direction: column;');
    expect(notesEditorRule).toContain('display: flex;');
    expect(notesEditorRule).toContain('flex: 1 1 auto;');
    expect(notesEditorRule).toContain('flex-direction: column;');
    expect(taskEditFormCss).toMatch(/\.shell\s*\{[\s\S]*min-height:\s*0;/);
    expect(getRuleBody(taskEditFormCss, '.root')).toContain('container-type: inline-size;');
    expect(getRuleBody(taskEditFormCss, '.root')).toContain('height: 100%;');
    expect(taskEditFormCss).toMatch(
      /\.notesEditor :global\(\.live-markdown-editor\)\s*\{[\s\S]*flex:\s*1 1 auto;/,
    );
    expect(taskEditFormCss).toMatch(
      /\.notesEditor :global\(\.live-editor-shell\)\s*\{[\s\S]*display:\s*flex;/,
    );
    expect(taskEditFormCss).toMatch(/@container \(max-width: 82em\)\s*\{[\s\S]*\.shell\s*\{/);
    expect(taskEditFormCss).toMatch(
      /@container \(max-width: 82em\)\s*\{[\s\S]*\.shell\s*\{[\s\S]*--task-edit-section-min-height:\s*clamp\(22rem,\s*48vh,\s*34rem\);/,
    );
    expect(taskEditFormCss).toMatch(
      /@container \(max-width: 82em\)\s*\{[\s\S]*\.sidebar\[data-layout='with-dispatch'\]\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*align-items:\s*start;/,
    );
    expect(taskEditFormCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.dispatchRail[\s\S]*padding:\s*0;/,
    );
    expect(taskEditFormCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.sidebar\[data-layout\]\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
    );
    expect(taskEditFormCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.activityCard[\s\S]*padding:\s*0;/,
    );
    expect(taskEditFormCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.shell\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/,
    );
    expect(taskEditFormCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.shell\s*\{[\s\S]*--task-edit-section-min-height:\s*clamp\(18rem,\s*42vh,\s*28rem\);/,
    );
    expect(taskEditFormCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.mainColumn\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/,
    );
    expect(taskEditFormCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.notesCard,\s*[\s\S]*\.activityCard\s*\{[\s\S]*flex:\s*0 0 auto;[\s\S]*width:\s*100%;/,
    );
    expect(mainColumnRule).not.toContain('height: 2000px;');
    expect(notesCardRule).not.toContain('height: 2000px;');
    expect(activityCardRule).not.toContain('height: 2000px;');
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
    const taskIdentityRowRule = getRuleBody(taskEditFormCss, '.taskIdentityRow');
    const projectNameRule = getRuleBody(taskEditFormCss, '.projectName');
    const settingsControlsRule = getRuleBody(taskEditFormCss, '.settingsControls');
    const priorityLabelRule = getRuleBody(taskMetadataControlsCss, '.priorityLabel');
    const priorityTriggerRule = getRuleBody(taskMetadataControlsCss, '.priorityTrigger');
    const settingsDividerRule = getRuleBody(taskEditFormCss, '.settingsDivider');

    expect(metaHeaderRule).toContain('display: grid;');
    expect(metaHeaderRule).toContain('gap:');
    expect(metaHeaderRule).toContain('padding: 0;');
    expect(settingsPanelRule).toContain('gap: 0.875rem;');
    expect(settingsPanelRule).toContain('max-width: 100%;');
    expect(settingsPanelRule).toContain('overflow-wrap: anywhere;');
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
    expect(taskIdentityRowRule).toContain('max-width: 100%;');
    expect(taskIdentityRowRule).toContain('flex-wrap: wrap;');
    expect(projectNameRule).toContain('max-width: 100%;');
    expect(projectNameRule).toContain('overflow-wrap: anywhere;');
    expect(settingsControlsRule).toContain('max-width: 100%;');
    expect(priorityLabelRule).toContain('line-height: 1.55;');
    expect(priorityLabelRule).toContain('overflow-wrap: anywhere;');
    expect(priorityTriggerRule).toContain('width: 100%;');
    expect(priorityTriggerRule).toContain('min-width: 0;');
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
    const taskDispatchPromptCollapsibleRule = getRuleBody(
      globalCss,
      ".task-dispatch-prompt[data-collapsible='true']",
    );
    const taskDispatchPromptCollapsedRule = getRuleBody(
      globalCss,
      ".task-dispatch-prompt[data-collapsible='true'][data-expanded='false']",
    );
    const taskDispatchPromptExpandedRule = getRuleBody(
      globalCss,
      ".task-dispatch-prompt[data-collapsible='true'][data-expanded='true']",
    );
    const taskDispatchCopyRule = getRuleBody(globalCss, '.task-dispatch-copy');
    const taskDispatchSendRule = getRuleBody(globalCss, '.task-dispatch-send');

    expect(globalCss).not.toContain('.task-edit-meta-actions');
    expect(openclawActionsRule).toContain('display: flex;');
    expect(openclawActionsRule).toContain('width: 100%;');
    expect(getRuleBody(globalCss, '.task-dispatch-actions')).toContain('display: grid;');
    expect(taskDispatchPanelRule).toContain('display: grid;');
    expect(taskDispatchPanelRule).toContain('gap: 0.625rem;');
    expect(globalCss).toMatch(
      /@container \(min-width: 25rem\)\s*\{[\s\S]*?\.task-dispatch-panel\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
    );
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
    expect(taskDispatchPromptCollapsibleRule).toContain('cursor: pointer;');
    expect(taskDispatchPromptCollapsedRule).toContain('min-height: auto;');
    expect(taskDispatchPromptCollapsedRule).toContain('max-height: none;');
    expect(taskDispatchPromptCollapsedRule).toContain('overflow: hidden;');
    expect(taskDispatchPromptCollapsedRule).toContain('white-space: nowrap;');
    expect(taskDispatchPromptCollapsedRule).toContain('text-overflow: ellipsis;');
    expect(taskDispatchPromptExpandedRule).toContain('min-height: auto;');
    expect(taskDispatchPromptExpandedRule).toContain('max-height: 14rem;');
    expect(taskDispatchPromptExpandedRule).toContain('overflow: auto;');
    expect(taskDispatchPromptExpandedRule).toContain('white-space: pre-wrap;');
    expect(taskDispatchCopyRule).toContain('position: absolute;');
    expect(taskDispatchCopyRule).toContain('opacity: 0;');
    expect(globalCss).toMatch(
      /\.task-dispatch-prompt-shell:hover \.task-dispatch-copy,\s*\.task-dispatch-prompt-shell:focus-within \.task-dispatch-copy\s*\{[\s\S]*opacity:\s*1;/,
    );
    expect(taskDispatchSendRule).toContain('width: 100%;');
    expect(taskDispatchSendRule).toContain('background: var(--ui-accent);');
  });

  it('keeps live markdown editing inline without an empty list highlight lane', () => {
    const editorInputRule = getRuleBody(globalCss, '.live-editor-input');
    const paragraphRule = getRuleBody(globalCss, '.live-editor-paragraph');
    const emptyListRule = getRuleBody(
      globalCss,
      ".live-editor-input [data-live-editor-empty='true']",
    );

    expect(globalCss).not.toContain('.live-editor-active-source');
    expect(globalCss).not.toContain("[data-live-editor-editing-source='true']");
    expect(globalCss).not.toContain(
      "[data-live-editor-heading-prefix][data-live-editor-active='true']::before",
    );
    expect(globalCss).toContain("[data-live-editor-heading-source='h3']");
    expect(globalCss).toContain('--live-editor-heading-marker-color:');

    expect(editorInputRule).toContain('line-height: 1.5;');

    expect(paragraphRule).toContain('margin: 0;');
    expect(paragraphRule).toContain('min-height: 1.5em;');

    expect(emptyListRule).toContain('min-height: 1.5em;');
    expect(emptyListRule).toContain('position: relative;');
    expect(globalCss).not.toContain(".live-editor-input [data-live-editor-empty='true']::after");
  });

  it('renders live checklist markers at form-checkbox scale', () => {
    const sharedRule = getRuleBody(
      globalCss,
      '.live-editor-li-unchecked::before,\n.live-editor-li-checked::before',
    );
    const uncheckedRule = getRuleBody(globalCss, '.live-editor-li-unchecked::before');
    const checkedRule = getRuleBody(globalCss, '.live-editor-li-checked::before');

    expect(sharedRule).toContain("content: '';");
    expect(sharedRule).toContain('width: 16px;');
    expect(sharedRule).toContain('height: 16px;');
    expect(sharedRule).toContain('border:');
    expect(uncheckedRule).not.toContain('☐');
    expect(checkedRule).not.toContain('☑');
  });
});
