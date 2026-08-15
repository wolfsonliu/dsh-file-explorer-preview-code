/** Editor + status-bar styles injected as a <style> tag (external plugins cannot import CSS modules). */
export const EDITOR_CSS = `
.dsh-cp {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.dsh-cp-editor {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.dsh-cp-editor .cm-editor {
  height: 100%;
  font-size: 13px;
}
.dsh-cp-editor .cm-scroller {
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  line-height: 1.6;
  overflow: auto;
}
.dsh-cp-status {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 4px 8px;
  border-top: 1px solid var(--dsw-alias-border-l2, #0000001a);
  background: var(--dsw-alias-bg-layer-1, #f5f5f5);
  color: var(--dsw-alias-label-secondary, #777);
  font: 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
  user-select: none;
}
.dsh-cp-lang {
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #333);
}
.dsh-cp-save {
  margin-left: auto;
}
.dsh-cp-save--dirty { color: var(--dsw-alias-state-warn-label, #a76500); }
.dsh-cp-save--saving { color: var(--dsw-alias-label-secondary, #777); }
.dsh-cp-save--saved { color: var(--dsw-alias-state-success-primary, #168f55); }
.dsh-cp-save--error { color: var(--dsw-alias-state-error-primary, #d73535); }
.dsh-cp-pos { color: var(--dsw-alias-label-tertiary, #777); }
.dsh-cp-save-btn {
  border: 1px solid var(--dsw-alias-border-l2, #0000001a);
  background: transparent;
  color: inherit;
  border-radius: 4px;
  padding: 1px 8px;
  cursor: pointer;
  font: inherit;
}
.dsh-cp-save-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, #0000000d);
}
.dsh-cp-save-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
`;
