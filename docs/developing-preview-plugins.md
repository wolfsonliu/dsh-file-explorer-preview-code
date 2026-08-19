# Developing a `dsh-file-explorer` preview plugin

[中文](developing-preview-plugins.zh.md) | English

This guide shows how to build a plugin that contributes a previewer (or editor) to [dsh-file-explorer](https://github.com/wolfsonliu/dsh-file-explorer), using **this repository** ([dsh-file-explorer-preview-code](https://github.com/wolfsonliu/dsh-file-explorer-preview-code)) as the reference implementation.

## Overview

`dsh-file-explorer` renders a file preview by extension. Its built-in previewers are registered at priority `0`:

- `text` (plain `<pre><code>`) for a list of code extensions,
- `markdown` (`.md`/`.mdx`), `image` (`.png`/`.jpg`/…), and `binary` (file info).

An external plugin can **override** any of these, or add a previewer for a brand-new extension, by injecting the `fileExplorer` cordis service and calling `registerPreview(ext, component, priority)`. Higher priority wins; this plugin uses `10` to override the built-in plain-text preview.

```
@dsh-external/dsh-file-explorer (core)
  └─ client apply: ctx.reflect.provide('fileExplorer', { registerPreview, registerFileAction, writeFile })

@dsh-external/dsh-file-explorer-preview-<domain> (your plugin)
  └─ inject: ['fileExplorer']
  └─ apply: ctx.fileExplorer.registerPreview(ext, Preview, 10)
```

## The contract

Types come from the core package's `./client` export:

```typescript
import type {
  FileExplorerService,
  PreviewProps,
  Translate,
} from '@dsh-external/dsh-file-explorer/client'
```

```typescript
interface FileExplorerService {
  registerPreview(ext: string, component: ComponentType<PreviewProps>, priority?: number): () => void
  registerFileAction(action: FileAction): () => void
  writeFile(path: string, content: string): Promise<void>
}

interface PreviewProps {
  preview: FilePreview      // discriminated union: text / image / empty / binary / text-large / too-large
  filePath: string          // workspace-relative path
  t: Translate              // (key, params?) => string
  activeView: 'preview' | 'source'
  onViewSource?: () => void
}
```

`FilePreview`:

```typescript
type FilePreview =
  | { kind: 'text'; name: string; extension: string; content: string; size: number }
  | { kind: 'image'; name: string; mime: string; dataUrl: string; size: number }
  | { kind: 'empty'; name: string; size: 0 }
  | { kind: 'binary'; name: string; size: number; bytes: string; truncated: boolean }
  | { kind: 'text-large'; name: string; extension: string; size: number }
  | { kind: 'too-large'; name: string; size: number }
```

Two things to know about routing:

1. **`registerPreview` keys by lowercase extension** (no leading dot). `resolvePreview` falls back to the `binary` previewer for unregistered extensions.
2. **`resolvePreviewFor(preview, ext, readRawFile?)` routes kinds before consulting your component, but not always away from it.** `image` and `empty` always resolve to core's built-in previewers. `text-large`, `binary`, and `too-large` resolve to the extension-registered component when one exists — for `text-large`, an unregistered extension falls back to core's built-in paged text reader. So a text-oriented previewer registered for a text extension receives `text`, `text-large`, and possibly `binary`; add a `text-large` case (or fall through to your unhandled path). The optional third `readRawFile` argument pages large-text reads; pass your reader if you call this helper.

## Minimal skeleton

A read-only previewer is tiny:

```typescript
// src/client/index.ts
import type { ComponentType } from 'react'
import type { PreviewProps } from '@dsh-external/dsh-file-explorer/client'

export const inject = ['fileExplorer']

export function apply(ctx: {
  fileExplorer: { registerPreview(ext: string, comp: ComponentType<PreviewProps>, priority?: number): () => void }
  effect(cb: () => (() => void), label?: string): void
}): void {
  ctx.effect(() => {
    const dispose = ctx.fileExplorer.registerPreview('cif', CifPreview, 10)
    return () => dispose()
  }, 'my-preview: client')
}

function CifPreview(props: PreviewProps) {
  if (props.preview.kind !== 'text') return null
  // props.preview.content is the file text — parse and render it.
  return renderStructure(props.preview.content)
}
```

Key points:

- **Service name** is `fileExplorer`. Inject it with `inject: ['fileExplorer']`.
- **Priority** — higher wins; built-ins use `0`, use `10` to override. Equal priority: later registration wins.
- **`registerPreview` returns a disposer** — call it from `ctx.effect` cleanup so HMR/unload removes the registration.
- Register **many extensions** in a loop, returning every disposer (see `src/client/index.ts` here).

## Editing with autosave

If your previewer edits, save through `writeFile` (see `src/client/CodePreview.tsx` here for the full pattern):

```typescript
import { makeCodePreview } from './CodePreview.tsx'

export const inject = ['fileExplorer']

export function apply(ctx: { fileExplorer: FileExplorerService; effect(...): void }): void {
  ctx.effect(() => {
    const component = makeCodePreview(ctx.fileExplorer.writeFile)
    const disposers = CODE_EXTS.map(ext => ctx.fileExplorer.registerPreview(ext, component, 10))
    return () => { for (const d of disposers) d() }
  })
}
```

`writeFile(path, content)` is a full-file UTF-8 write, resolved against the current session's workspace. A `ComponentType<PreviewProps>` receives `filePath`, so bridge the service method into the component via a factory closure (a module-level variable also works, but a factory is explicit and testable).

## Bundling

A client-only plugin emits one browser bundle. This repo's `tsdown.config.mjs` is the template:

- **Externals (`neverBundle`)**: `@deepseek-ai/dsh-client-runtime/client`, `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`. These are provided by the platform module table.
- **Everything else is bundled** (`alwaysBundle: true`). CodeMirror and all `@codemirror/*` language packages must be inlined.
- **Single-file output**: the client bundle uses the `window.__ModuleLoader__.load({ id, factory })` banner/footer/intro, and `codeSplitting: false` so dynamic `import()`s (e.g. `@codemirror/language-data`'s lazy loads) inline into the one `lib/client.js`.
- **Node half**: a minimal no-op `apply()` in `src/index.ts` so the host Loader can import the roster row.

`package.json` manifest:

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime"] }
  }
}
```

`cordis.patch.yml` inserts the roster row:

```yaml
- insert:
    - id: my-preview
      name: '@dsh-external/dsh-file-explorer-preview-<domain>'
```

## Internationalization

To localize your own UI copy, inject the `locale` service alongside `fileExplorer`, register a `zh`/`en` dictionary under your own namespace, and bind a translator:

```typescript
export const inject = ['fileExplorer', 'locale']

export function apply(ctx: { fileExplorer: FileExplorerService; locale: LocaleService; effect(...): void }): void {
  ctx.effect(() => {
    const d1 = ctx.locale.register('my-preview', 'zh', { hello: '你好' })
    const d2 = ctx.locale.register('my-preview', 'en', { hello: 'Hello' })
    const t = ctx.locale.bind('my-preview')
    // ... pass `t` into your component and dispose d1/d2 on cleanup
  })
}
```

The `PreviewProps.t` you receive is bound to the *file-explorer* namespace (`emptyFile`/`binary`/`tooLarge`/…), not yours — bind your own for your own copy. See `src/client/locale.ts` here.

## Adding a file-row action (optional)

The same service exposes `registerFileAction`, which adds an item to a file row's "···" menu:

```typescript
ctx.fileExplorer.registerFileAction({
  id: 'my-action',
  label: 'My action',
  run: ({ filePath, openFile }) => { /* ... */ },
})
```

Check the `FileAction`/`FileActionHelpers` types from `@dsh-external/dsh-file-explorer/client` for the exact shape.

## Verifying

```sh
npm install
npm run check     # tsc type check
npm test          # vitest unit tests
npm run build     # tsc + tsdown
dsh plugin --profile web add .
dsh web
```

Then open a matching file in the explorer's preview box and confirm your component renders (and, for editors, that edits save through `writeFile`).

## Reference files in this repository

- `src/client/index.ts` — registration loop + style/locale setup.
- `src/client/CodePreview.tsx` — a CodeMirror editor with autosave, language loading, theme, and status bar.
- `src/client/languages.ts` — `@codemirror/language-data` matching.
- `src/client/locale.ts` — zh/en dictionaries.
- `tsdown.config.mjs` — the client-bundle preset.
- `tests/` — examples of testing registration, matching, and the component.
