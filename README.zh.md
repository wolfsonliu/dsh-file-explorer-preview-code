# dsh-file-explorer-preview-code

[English](README.md) | 中文

DSH Web 的 [CodeMirror 6](https://codemirror.net/) 代码预览与编辑器，基于 `codemirror`（`basicSetup`）+ `@codemirror/language-data`（按语言高亮）+ `@codemirror/theme-one-dark`（深色主题）构建。它以优先级 `10` 覆盖 [dsh-file-explorer](../dsh_lui) 内置的纯文本预览（优先级 `0`），为代码文件提供按语言区分的高亮，以及支持自动保存的就地编辑。

## 截图

| 深色主题 | 浅色主题 |
| --- | --- |
| ![深色主题下的代码预览](assets/dsh-file-explorer-preview-code_dark.png) | ![浅色主题下的代码预览](assets/dsh-file-explorer-preview-code_light.png) |

## 功能

1. **语法高亮**：通过 `@codemirror/language-data` 按文件名解析语言（约 90 种），`.ts`/`.tsx`/`.js`/`.jsx`/`.json`/`.css`/`.html`/`.py`/`.yaml`/`.yml`/`.toml`/`.sh`/`.go`/`.rs`/`.java`/`.c`/`.cpp`/`.h`/`.xml`/`.sql`/`.ini` 等都能得到正确的着色。
2. **就地编辑**：预览框是真正的 CodeMirror 编辑器（行号、撤销/重做、软换行），而非只读的 `<pre>`。
3. **自动保存**：停止输入 500ms 后自动保存，`Ctrl/Cmd+S` 立即保存。
4. **保存状态栏**：底部细栏显示语言、`Ln/Col` 光标位置与保存状态（未保存 / 保存中… / 已保存 / 保存失败），并提供手动保存按钮。
5. **主题感知**：高亮实时跟随 DSH 的深色/浅色切换（`data-ds-dark-theme`）。
6. **可扩展设计**：通过 `fileExplorer` 服务注册，不改动核心文件浏览器。

## 依赖

本插件**依赖** [`@dsh-external/dsh-file-explorer`](../dsh_lui)——它注入 `fileExplorer` cordis 服务，由该服务提供 `registerPreview` 与 `writeFile`（保存路径）。请先安装并启用 `dsh-file-explorer`，再安装本插件：

```sh
# 在 dsh-file-explorer 仓库中
npm install && npm run build
dsh plugin --profile web add .

# 在本仓库中
npm install && npm run build
dsh plugin --profile web add .
```

> 本地开发时，本仓库的 `devDependencies` 以 `"@dsh-external/dsh-file-explorer": "file:../dsh_lui"` 指向同级 checkout，以便 `tsc` 解析 `./client` 类型定义。请把该路径指向你自己的 checkout（或你 registry 上已发布的包）后再执行 `npm install`。

## 安装

从本地目录安装：

```sh
git clone <this-repo>
cd dsh-file-explorer-preview-code
npm install
npm run build
dsh plugin --profile web add .
dsh web
```

## 工作原理

客户端入口注入 `fileExplorer` 与 `locale`，为每个代码扩展名注册同一个 `CodePreview` 组件（优先级 `10`）：

```typescript
export const inject = ['fileExplorer', 'locale']

export function apply(ctx) {
  ctx.effect(() => {
    const component = makeCodePreview(ctx.fileExplorer.writeFile, ctx.locale.bind(CODE_NS))
    const disposers = CODE_EXTS.map(ext => ctx.fileExplorer.registerPreview(ext, component, 10))
    return () => { for (const d of disposers) d() }
  })
}
```

注册的扩展名（`CODE_EXTS`）：`ts tsx js jsx json css html py yaml yml toml env sh go rs java c cpp h xml sql graphql cfg ini`。

编辑器组件只会收到 `preview.kind === 'text'`（核心会先把 `empty` / `binary` / `too-large` / `image` 路由到自己的预览）。编辑内容通过 `fileExplorer.writeFile(filePath, content)` 写回。

## 配置

组合包只插入一行 roster 配置（无宿主端配置项）：

```yaml
- insert:
    - id: file-explorer-preview-code
      name: '@dsh-external/dsh-file-explorer-preview-code'
```

## 语言覆盖

`@codemirror/language-data` 可为 24 个扩展名中的 21 个匹配到语言。`env` 与 `graphql` 没有对应语言支持，会以纯文本（无高亮）的可编辑缓冲打开；`cfg` 会命中 language-data 的旧式 `TTCN_CFG`（属于匹配偏差，并非语义上的 `ini`）。这些扩展名仍会在编辑器中打开。

## 已知限制

- **体积**：所有 `@codemirror/*` 语言包被内联进单个 `lib/client.js`（约 2.7 MB 原始体积，按需懒加载）。
- **不支持 Markdown**：`.md`/`.mdx` 仍由 dsh-file-explorer 内置的 markdown 预览处理。
- **直写**：编辑直接写回工作区文件，无保存前 diff、无多标签页。
- **大文件**：超过 dsh-file-explorer `maxTextBytes` 的文件会在进入本插件前被核心拒绝。

## 开发预览插件

本仓库即「开发 preview 插件」的参考实现。契约、最小骨架、打包要点与 i18n 见 [docs/developing-preview-plugins.zh.md](docs/developing-preview-plugins.zh.md)（[English](docs/developing-preview-plugins.md)）。

## 开发

```sh
npm install
npm run check     # tsc 类型检查
npm test          # vitest 单元测试
npm run build     # tsc + tsdown（宿主 ESM 占位 + 客户端 CJS bundle）
```

> `npm run build` 之后请**强制刷新浏览器**（`Ctrl/Cmd+Shift+R`）：`dsh web` 可能仍缓存着旧的插件 bundle，普通刷新可能不会加载你最新的构建。

## 许可

[MIT](LICENSE)
