/** Locale namespace owning the editor status-bar copy. */
export const CODE_NS = 'file-explorer-preview-code';
export const ZH = {
    save: '保存',
    saving: '保存中…',
    saved: '已保存',
    saveFailed: '保存失败',
    unsaved: '未保存',
    plainText: '纯文本',
};
export const EN = {
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'Save failed',
    unsaved: 'Unsaved',
    plainText: 'Plain text',
};
/** Register the plugin's zh/en dictionaries; returns a disposer for both. */
export function registerCodePreviewLocale(ctx) {
    const d1 = ctx.locale.register(CODE_NS, 'zh', ZH);
    const d2 = ctx.locale.register(CODE_NS, 'en', EN);
    return () => { d1(); d2(); };
}
