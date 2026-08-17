import { CODE_EXTS } from "../protocol.js";
import { makeCodePreview } from "./CodePreview.js";
import { CODE_NS, registerCodePreviewLocale } from "./locale.js";
import { EDITOR_CSS } from "./styles.js";
export const inject = ['fileExplorer', 'locale'];
// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------
export function apply(ctx) {
    // Inject editor styles (an external plugin cannot import a CSS module).
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-code-preview-style', '');
    styleEl.textContent = EDITOR_CSS;
    document.head.appendChild(styleEl);
    ctx.effect(() => {
        const disposeLocale = registerCodePreviewLocale(ctx);
        const t = ctx.locale.bind(CODE_NS);
        const writeFile = ctx.fileExplorer.writeFile;
        // Probe readRawFile availability (added in dsh-file-explorer v0.1.0).
        const readRaw = typeof ctx.fileExplorer.readRawFile === 'function'
            ? ctx.fileExplorer.readRawFile.bind(ctx.fileExplorer)
            : undefined;
        // Register one shared editor component for every code extension at
        // priority 10, so it overrides dsh-file-explorer's built-in plain-text
        // preview (priority 0).
        const component = makeCodePreview(writeFile, readRaw, t);
        const disposers = CODE_EXTS.map(ext => ctx.fileExplorer.registerPreview(ext, component, 10));
        return () => {
            for (const dispose of disposers)
                dispose();
            disposeLocale();
            styleEl.remove();
        };
    }, 'file-explorer-preview-code: client');
}
