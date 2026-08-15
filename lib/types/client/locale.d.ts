import type { Translate } from '@dsh-external/dsh-file-explorer/client';
/** Locale namespace owning the editor status-bar copy. */
export declare const CODE_NS = "file-explorer-preview-code";
export declare const ZH: {
    readonly save: "保存";
    readonly saving: "保存中…";
    readonly saved: "已保存";
    readonly saveFailed: "保存失败";
    readonly unsaved: "未保存";
    readonly plainText: "纯文本";
};
export declare const EN: {
    readonly save: "Save";
    readonly saving: "Saving…";
    readonly saved: "Saved";
    readonly saveFailed: "Save failed";
    readonly unsaved: "Unsaved";
    readonly plainText: "Plain text";
};
interface LocaleContext {
    locale: {
        register(ns: string, locale: string, dict: Record<string, string>): () => void;
        bind(ns: string): Translate;
    };
}
/** Register the plugin's zh/en dictionaries; returns a disposer for both. */
export declare function registerCodePreviewLocale(ctx: LocaleContext): () => void;
export {};
