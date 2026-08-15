# 开发一个 `dsh-file-explorer` 预览插件

[English](developing-preview-plugins.md) | 中文

本指南说明如何为 [dsh-file-explorer](https://github.com/wolfsonliu/dsh-file-explorer) 开发一个贡献预览器（或编辑器）的插件，并以**本仓库**（[dsh-file-explorer-preview-code](https://github.com/wolfsonliu/dsh-file-explorer-preview-code)）作为参考实现。

## 概览

`dsh-file-explorer` 按扩展名渲染文件预览。其内置预览器都以优先级 `0` 注册：

- `text`（纯文本 `<pre><code>`，覆盖一批代码扩展名）、
- `markdown`（`.md`/`.mdx`）、`image`（`.png`/`.jpg`/…）、`binary`（文件信息）。

外部插件可通过注入 `fileExplorer` cordis 服务并调用 `registerPreview(ext, component, priority)` 来**覆盖**任意内置预览，或为全新扩展名新增预览器。优先级数值越大越优先；本插件用 `10` 覆盖内置纯文本预览。

```
@dsh-external/dsh-file-explorer（核心）
  └─ 客户端 apply：ctx.reflect.provide('fileExplorer', { registerPreview, registerFileAction, writeFile })

@dsh-external/dsh-file-explorer-preview-<domain>（你的插件）
  └─ inject: ['fileExplorer']
  └─ apply：ctx.fileExplorer.registerPreview(ext, Preview, 10)
```

## 契约

类型来自核心包的 `./client` 导出：

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
  preview: FilePreview      // 判别式联合：text / image / empty / binary / too-large
  filePath: string          // 工作区相对路径
  t: Translate              // (key, params?) => string
  activeView: 'preview' | 'source'
  onViewSource?: () => void
}
```

`FilePreview`：

```typescript
type FilePreview =
  | { kind: 'text'; name: string; extension: string; content: string; size: number }
  | { kind: 'image'; name: string; mime: string; dataUrl: string; size: number }
  | { kind: 'empty'; name: string; size: 0 }
  | { kind: 'binary'; name: string; size: number }
  | { kind: 'too-large'; name: string; size: number }
```

关于路由的两点须知：

1. **`registerPreview` 以小写扩展名为键**（不含前导点）。`resolvePreview` 对未注册扩展名回退到 `binary` 预览器。
2. **核心会先把非文本 kind 路由走，再轮到你。** `resolvePreviewFor(preview, ext)` 在 `preview.kind !== 'text'` 时直接返回 image/status 预览，因此面向文本的预览器只会收到 `preview.kind === 'text'`。（防御式组件仍会对其他 kind 返回 `null`。）

## 最小骨架

只读预览器非常小：

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
  // props.preview.content 即文件文本——解析并渲染。
  return renderStructure(props.preview.content)
}
```

要点：

- **服务名**为 `fileExplorer`，用 `inject: ['fileExplorer']` 注入。
- **优先级**：数值越大越优先；内置为 `0`，用 `10` 覆盖。同优先级后注册者胜。
- **`registerPreview` 返回 disposer**——在 `ctx.effect` 清理中调用，以便 HMR/卸载时移除注册。
- 可**循环注册多个扩展名**，返回所有 disposer（见本仓库 `src/client/index.ts`）。

## 带自动保存的编辑

如果预览器需要编辑，通过 `writeFile` 保存（完整模式见本仓库 `src/client/CodePreview.tsx`）：

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

`writeFile(path, content)` 是对工作区文件的整文件 UTF-8 写入（相对当前会话工作区解析）。`ComponentType<PreviewProps>` 会收到 `filePath`，因此用工厂闭包把服务方法桥接进组件（模块级变量亦可，但工厂更显式、更易测试）。

## 打包

纯客户端插件只产出一个浏览器 bundle。本仓库的 `tsdown.config.mjs` 即模板：

- **外部依赖（`neverBundle`）**：`@deepseek-ai/dsh-client-runtime/client`、`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`。这些由平台模块表提供。
- **其余全部打进 bundle**（`alwaysBundle: true`）。CodeMirror 及所有 `@codemirror/*` 语言包必须内联。
- **单文件输出**：客户端 bundle 使用 `window.__ModuleLoader__.load({ id, factory })` 的 banner/footer/intro，并设置 `codeSplitting: false`，让动态 `import()`（如 `@codemirror/language-data` 的懒加载）内联进单个 `lib/client.js`。
- **宿主半部**：`src/index.ts` 里放一个最小 no-op `apply()`，以便宿主 Loader 能导入该 roster 行。

`package.json` manifest：

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime"] }
  }
}
```

`cordis.patch.yml` 插入 roster 行：

```yaml
- insert:
    - id: my-preview
      name: '@dsh-external/dsh-file-explorer-preview-<domain>'
```

## 国际化

要本地化你自己的文案，请在 `fileExplorer` 之外再注入 `locale` 服务，用自己的命名空间注册 `zh`/`en` 字典，并绑定翻译器：

```typescript
export const inject = ['fileExplorer', 'locale']

export function apply(ctx: { fileExplorer: FileExplorerService; locale: LocaleService; effect(...): void }): void {
  ctx.effect(() => {
    const d1 = ctx.locale.register('my-preview', 'zh', { hello: '你好' })
    const d2 = ctx.locale.register('my-preview', 'en', { hello: 'Hello' })
    const t = ctx.locale.bind('my-preview')
    // ... 把 t 传入组件，并在清理时 dispose d1/d2
  })
}
```

你收到的 `PreviewProps.t` 绑定在 *file-explorer* 命名空间（`emptyFile`/`binary`/`tooLarge`/…），而非你自己的——请为自己的文案绑定自己的命名空间。见本仓库 `src/client/locale.ts`。

## 添加文件行操作（可选）

同一服务还暴露 `registerFileAction`，可在文件行「···」菜单中加一项：

```typescript
ctx.fileExplorer.registerFileAction({
  id: 'my-action',
  label: '我的操作',
  run: ({ filePath, openFile }) => { /* ... */ },
})
```

精确结构见 `@dsh-external/dsh-file-explorer/client` 的 `FileAction`/`FileActionHelpers` 类型。

## 验证

```sh
npm install
npm run check     # tsc 类型检查
npm test          # vitest 单元测试
npm run build     # tsc + tsdown
dsh plugin --profile web add .
dsh web
```

然后在浏览器的预览框里打开对应文件，确认你的组件正常渲染（对编辑器而言，确认编辑内容能通过 `writeFile` 保存）。

## 本仓库的参考文件

- `src/client/index.ts` — 注册循环 + 样式/locale 装配。
- `src/client/CodePreview.tsx` — 带自动保存、语言加载、主题与状态栏的 CodeMirror 编辑器。
- `src/client/languages.ts` — `@codemirror/language-data` 匹配。
- `src/client/locale.ts` — 中英文典。
- `tsdown.config.mjs` — 客户端 bundle 预设。
- `tests/` — 注册、匹配与组件的测试示例。
