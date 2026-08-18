# AGENTS.md

`dsh-file-explorer-preview-code` is a DSH Web **preview plugin** for [`dsh-file-explorer`](https://github.com/wolfsonliu/dsh-file-explorer): a [CodeMirror 6](https://codemirror.net/) code preview + editor that overrides the core's built-in plain-text preview (priority `0`) with per-language syntax highlighting, in-place editing, and autosave, registered at priority `10`. It runs on vendored Cordis, where **everything is a plugin** — the host half and the client half each expose an `apply(ctx)` entry. This plugin is **client-only**: the host half is a no-op stub.

- [README.md](README.md) — the user-facing contract (features, install, data layer). [README.zh.md](README.zh.md) is the paired Chinese version.
- [docs/developing-preview-plugins.md](docs/developing-preview-plugins.md) — the reference implementation guide for authoring a `dsh-file-explorer` preview plugin (plus its [.zh.md](docs/developing-preview-plugins.zh.md) twin).

## Repository layout

```
src/
  index.ts            host half: minimal no-op cordis plugin (client-only — no server route, no host config)
  protocol.ts         PLUGIN_ID + CODE_EXTS — the only constants shared between halves
  client/
    index.ts              browser half: injects fileExplorer + locale, injects editor CSS,
                          registers one CodeMirror preview component per code extension
    CodePreview.tsx       makeCodePreview — CodeMirror 6 editor, autosave, save-state bar, theme reactivity
    languages.ts          languageDescriptionFor — @codemirror/language-data matching (sync, pure)
    locale.ts             CODE_NS + ZH/EN dictionaries + locale registration
    styles.ts             EDITOR_CSS string, injected as a <style data-code-preview-style> tag
tests/                vitest specs — node env by default; *.spec.tsx opt into jsdom
lib/                  built output, tracked — lib/index.js (ESM stub) + lib/client.js(+.map) CJS bundle
                      + lib/types (JS + .d.ts for every src file)
docs/                 developing-preview-plugins.{md,zh.md} are tracked; specs/ & plans/ are gitignored local-only
assets/               dark/light screenshots
cordis.patch.yml      bundle patch layer — inserts the roster row (no host-side configuration)
```

## Commands

```sh
npm install
npm test          # vitest run (tests/**/*.spec.{ts,tsx})
npm run check     # tsc -p tsconfig.json --noEmit (type-checks src/ only; tests are NOT type-checked)
npm run build     # tsc + tsdown → host ESM stub lib/index.js + client CJS bundle lib/client.js (+ lib/types)
```

- Run one spec with `./node_modules/.bin/vitest run tests/<file>` — never `npx vitest` (the npm cache is read-only in this environment).
- `npm run check` covers `src/` only: `tsconfig.json` includes `src/**/*.{ts,tsx}` and excludes `tests`. Tests are exercised at runtime by vitest, not by `tsc`.
- The devDependency `@dsh-external/dsh-file-explorer` is installed from git (see `package.json`) so `tsc` resolves its `./client` type definitions (`FileExplorerService`, `PreviewProps`, `Translate`) without a local checkout.
- `tsdown.config.mjs` owns the two-bundle split. The host build emits ESM `lib/index.js` from the tsc-emitted `lib/types/index.js` stub. The client build emits a single CJS `lib/client.js` wrapped as a `window.__ModuleLoader__.load({ id, factory: require => … })` factory, with `codeSplitting: false` so `@codemirror/language-data`'s lazy dynamic `import()`s inline into that one file. The client's `neverBundle` list (`platformModules`) and `package.json`'s `dsh.client.inject` (`@deepseek-ai/dsh-client-runtime`) describe what the host supplies at runtime — keep them in sync with any new client-side import.

## Build & commit rules

- `lib/` is committed (including every `lib/types/**` file). After any `src/` change, run `npm run build` and commit the regenerated `lib/` as its own `chore: rebuild lib artifacts` commit. Downstream consumers resolve `lib/` directly, so it must never lag `src/`.
- `docs/specs/` and `docs/plans/` are gitignored — never commit them. (`docs/developing-preview-plugins.{md,zh.md}` is NOT gitignored and IS tracked.)
- Commit messages use conventional prefixes: `feat:`, `fix:`, `test:`, `chore:`, `docs:`.
- Do not fold unrelated working-tree changes into a feature commit; keep them separate (unless the user asks otherwise).

## Architecture conventions

- **Client-only, two halves.** The host (`src/index.ts`) is a no-op `apply() {}` that exists only so the host Loader can import this roster row (every `cordis.patch.yml` row is imported host-side). The client (`src/client/index.ts`, `inject: ['fileExplorer', 'locale']`) renders the CodeMirror editor and does all the work. This plugin has no filesystem access, no server route, and no host config of its own — reads and writes go through the core's `fileExplorer` service.

- **It consumes — it never provides — `fileExplorer`.** The service is supplied by the core `dsh-file-explorer` plugin. The client narrows it via a local type (`MyFileExplorer`) that adds the optional `readRawFile(path, offset?, limit?) → ArrayBuffer` (added in core v0.1.0). Contract types are imported from `@dsh-external/dsh-file-explorer/client` and are **not** redefined locally.

- **Overriding via priority.** `registerPreview(ext, component, priority?)` — higher priority wins, later registration wins ties, built-ins use `0`. This plugin registers **one shared component** for every entry in `CODE_EXTS` (`src/protocol.ts`) at priority `10`. The constant is lowercase, no leading dot.

- **Kind-aware routing in `CodePreview.tsx`.** Switch on the discriminated `preview.kind`: `text` uses `preview.content` directly (≤ 2 MiB, the core's `maxTextBytes`); `too-large`/`binary` call `readRawFile(filePath)` and decode the `ArrayBuffer` as UTF-8; `empty` mounts no editor; `image`/unknown render nothing. When `readRawFile` is absent, `too-large`/`binary` show an upgrade prompt instead of failing.

- **Autosave state machine.** Edits debounce 500ms (`AUTOSAVE_DELAY_MS`) after the last keystroke, and `Ctrl/Cmd+S` saves immediately. All writes flow through `fileExplorer.writeFile(filePath, content)` (full-file UTF-8 write). `saveChainRef` serializes async writes; `generationRef` + `disposedRef` guard async state so a stale save/load can never set state after file-change or unmount.

- **Theme reactivity.** Highlighting follows DSH's dark/light toggle (`data-ds-dark-theme` on `document.body`). A `MutationObserver` watches that attribute and reconfigure a `Compartment` between `oneDark` + `oneDarkHighlightStyle` (dark) and `defaultHighlightStyle` (light).

- **Language loading is async, matching is sync.** `languageDescriptionFor(fileName)` (`src/client/languages.ts`) matches the basename synchronously via `LanguageDescription.matchFilename`. The editor then awaits `description.load()` and reconfigures the language compartment only if still mounted (guard `disposedRef` / `viewRef`) — this matters because `@codemirror/language-data` loads languages lazily.

- **Styles are injected, not imported.** An external plugin cannot import a CSS module, so styles live in `EDITOR_CSS` (`src/client/styles.ts`) and are injected by `apply` as a `<style data-code-preview-style>` tag. Class scope is `.dsh-cp-*`; theme surface values are `var(--dsw-alias-*, fallback)`. Prefer class-selector scoping with no globals that could leak outside `.dsh-cp-*`.

- **One disposer tears everything down.** `apply` registers locales, probes `readRawFile`, registers all `CODE_EXTS` previews, and returns a single `ctx.effect` disposer that disposes every `registerPreview` disposer, disposes both locale registrations, and removes the injected `<style>` tag. Keep the disposer complete — this is what makes unload/HMR safe.

## Configuration

This plugin has **no `Config`** and no host-side defaults. `cordis.patch.yml` inserts one roster row only:

```yaml
- insert:
    - id: file-explorer-preview-code
      name: '@dsh-external/dsh-file-explorer-preview-code'
```

The bundle's runtime wiring is described by `package.json`'s `dsh.client` (`platform: "web"`, `inject: ["@deepseek-ai/dsh-client-runtime"]`). The only size/behavior cap this plugin depends on is the core's `maxTextBytes` (2 MiB), which decides whether a text file arrives as `kind: 'text'` or `kind: 'too-large'`.

## Coding conventions

- Strict TypeScript (`strict: true`, `noEmitOnError`), ESM everywhere (`"type": "module"`), `.ts`/`.tsx` extensions in relative imports (`allowImportingTsExtensions` + `rewriteRelativeImportExtensions`).
- Switch on the discriminated `preview.kind` tag rather than scattering type-narrowing checks without a documented default.
- Trust TypeScript at typed same-process boundaries: do not add runtime validation for values the `PreviewProps` union already guarantees. Validate at the service boundary instead — in this plugin that is the `readRawFile` presence probe (`typeof ctx.fileExplorer.readRawFile === 'function'`) and the `preview.kind` dispatch.
- React uses `jsx: react-jsx` (no `React` import needed just for JSX); import hooks/types by name. Async state updates after unmount or after a file change are guarded by `disposedRef`/`generationRef`/`viewRef`.
- **`data-code-preview-style` is the test-hook contract** for the injected stylesheet. Tests locate the injected node via `document.querySelector('style[data-code-preview-style]')`, never via fragile class-name or text matching. When you add interactive surface, add a stable `data-*`/class hook and keep existing hook values backward-compatible (tests assert against them).
- An empty/ignored `catch` names what it swallows and why (e.g. the best-effort final save in `_cleanup`). Keep the `try` to one statement.
- Prefer zero new dependencies for small pure helpers (e.g. the hand-rolled locale dictionaries and CSS string) over pulling a package for one function. The only runtime deps are `codemirror` and the `@codemirror/*` packages; `react`/`react-dom` are peer platform modules supplied by the host and listed in `platformModules`.
- Files end with exactly one trailing newline. Keep `lib/` and `src/` in lockstep per the build rules above.

## i18n & bilingual docs

- UI copy lives in `src/client/locale.ts` as `ZH`/`EN` const objects under `CODE_NS = 'file-explorer-preview-code'`. **Key sets must stay identical** — add any new string to both dictionaries at once. `registerCodePreviewLocale` registers both and returns a disposer for the pair; `apply` binds the translator via `ctx.locale.bind(CODE_NS)`.
- The translator the component receives is **this plugin's** (`t` from `CODE_NS`), distinct from `PreviewProps.t` (bound to the core `file-explorer` namespace). Use the plugin's `t` for editor status-bar copy and `Signed`/`Unsaved`/`Save` labels.
- `README.md` / `README.zh.md`, and `docs/developing-preview-plugins.md` / `.zh.md`, are bilingual pairs of equal authority. After editing one side, bring the other along in the same commit.

## Testing

- Tests live in `tests/` and describe behavior, not implementation. `*.spec.ts` run under node; `*.spec.tsx` begin with `// @vitest-environment jsdom`.
- Follow TDD: write the failing test, watch it fail, then implement the minimum to pass.
- Coverage map:

  | Spec | Covers |
  | --- | --- |
  | `apply.spec.tsx` | client `apply` bootstrap — registers a preview for every `CODE_EXTS` entry at priority `10`, registers zh/en dictionaries under `file-explorer-preview-code`, full teardown on disposer, and `readRawFile` presence/absence probing |
  | `code-preview.spec.tsx` | `makeCodePreview` component rendering for a non-text preview kind |
  | `languages.spec.ts` | `languageDescriptionFor` — extension → language mapping, exact-filename (basename) matching, `null` for unsupported extensions |

## Developing preview plugins

This repo is the reference implementation for a `dsh-file-explorer` preview plugin. The authoritative guide is [docs/developing-preview-plugins.md](docs/developing-preview-plugins.md) (keep it and its `.zh.md` twin updated whenever this plugin's contract pattern changes). The minimal shape:

```typescript
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
```

The contract (`FileExplorerService`, `PreviewProps`, `FilePreview`) is owned by `@dsh-external/dsh-file-explorer` — this plugin only consumes it, so treat those imported types as semver-stable and do not redefine them locally.