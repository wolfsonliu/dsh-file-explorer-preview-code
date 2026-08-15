// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apply } from '../src/client/index.ts'
import { CODE_EXTS } from '../src/protocol.ts'

interface MockCtx {
  fileExplorer: {
    registerPreview: ReturnType<typeof vi.fn>
    registerFileAction: ReturnType<typeof vi.fn>
    writeFile: ReturnType<typeof vi.fn>
  }
  locale: {
    register: ReturnType<typeof vi.fn>
    bind: ReturnType<typeof vi.fn>
  }
  effect: ReturnType<typeof vi.fn>
}

function makeCtx(): { ctx: MockCtx; cleanup: () => void } {
  let cleanup: () => void = () => {}
  const ctx: MockCtx = {
    fileExplorer: {
      registerPreview: vi.fn(() => () => {}),
      registerFileAction: vi.fn(),
      writeFile: vi.fn(async () => {}),
    },
    locale: {
      register: vi.fn(() => () => {}),
      bind: vi.fn(() => ((key: string) => key)),
    },
    effect: vi.fn((cb: () => (() => void)) => { cleanup = cb() }),
  }
  return { ctx, cleanup: () => cleanup() }
}

beforeEach(() => {
  document.head.innerHTML = ''
})

describe('apply', () => {
  test('registers the code preview for every code extension at priority 10', () => {
    const { ctx } = makeCtx()
    apply(ctx as never)

    expect(ctx.fileExplorer.registerPreview).toHaveBeenCalledTimes(CODE_EXTS.length)
    for (const ext of CODE_EXTS) {
      expect(ctx.fileExplorer.registerPreview).toHaveBeenCalledWith(ext, expect.any(Function), 10)
    }
  })

  test('registers zh/en locale dictionaries for the plugin namespace', () => {
    const { ctx } = makeCtx()
    apply(ctx as never)

    expect(ctx.locale.register).toHaveBeenCalledWith('file-explorer-preview-code', 'zh', expect.any(Object))
    expect(ctx.locale.register).toHaveBeenCalledWith('file-explorer-preview-code', 'en', expect.any(Object))
  })

  test('cleanup disposes every preview registration, the locale, and the style tag', () => {
    const disposers: (() => void)[] = []
    let cleanup: () => void = () => {}
    const ctx: MockCtx = {
      fileExplorer: {
        registerPreview: vi.fn(() => { const d = vi.fn(); disposers.push(d); return d }),
        registerFileAction: vi.fn(),
        writeFile: vi.fn(async () => {}),
      },
      locale: {
        register: vi.fn(() => vi.fn()),
        bind: vi.fn(() => ((key: string) => key)),
      },
      effect: vi.fn((cb: () => (() => void)) => { cleanup = cb() }),
    }
    apply(ctx as never)

    expect(disposers).toHaveLength(CODE_EXTS.length)
    expect(document.querySelector('style[data-code-preview-style]')).not.toBeNull()

    cleanup()
    for (const dispose of disposers) expect(dispose).toHaveBeenCalledTimes(1)
    expect(document.querySelector('style[data-code-preview-style]')).toBeNull()
  })
})
