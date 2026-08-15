import type { FileExplorerService, Translate } from '@dsh-external/dsh-file-explorer/client'
import { CODE_EXTS } from '../protocol.ts'
import { makeCodePreview } from './CodePreview.tsx'
import { CODE_NS, registerCodePreviewLocale } from './locale.ts'
import { EDITOR_CSS } from './styles.ts'

// ---------------------------------------------------------------------------
// Client context (the shape of the Cordis context the client plugin receives)
// ---------------------------------------------------------------------------
interface ClientContext {
  fileExplorer: FileExplorerService
  locale: {
    register(ns: string, locale: string, dict: Record<string, string>): () => void
    bind(ns: string): Translate
  }
  effect(callback: () => (() => void), label?: string): void
}

export const inject = ['fileExplorer', 'locale']

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------
export function apply(ctx: ClientContext): void {
  // Inject editor styles (an external plugin cannot import a CSS module).
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-code-preview-style', '')
  styleEl.textContent = EDITOR_CSS
  document.head.appendChild(styleEl)

  ctx.effect(() => {
    const disposeLocale = registerCodePreviewLocale(ctx)
    const t = ctx.locale.bind(CODE_NS)
    const writeFile = ctx.fileExplorer.writeFile

    // Register one shared editor component for every code extension at
    // priority 10, so it overrides dsh-file-explorer's built-in plain-text
    // preview (priority 0).
    const component = makeCodePreview(writeFile, t)
    const disposers = CODE_EXTS.map(ext =>
      ctx.fileExplorer.registerPreview(ext, component, 10),
    )

    return () => {
      for (const dispose of disposers) dispose()
      disposeLocale()
      styleEl.remove()
    }
  }, 'file-explorer-preview-code: client')
}
