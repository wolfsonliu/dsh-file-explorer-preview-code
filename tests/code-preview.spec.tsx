// @vitest-environment jsdom
import { act } from 'react'
import { describe, expect, test } from 'vitest'
import { createRoot } from 'react-dom/client'
import type { PreviewProps } from '@dsh-external/dsh-file-explorer/client'
import { makeCodePreview } from '../src/client/CodePreview.tsx'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const t = ((key: string) => `T:${key}`) as PreviewProps['t']
const writeFile = async (): Promise<void> => {}

function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return container
}

describe('CodePreview', () => {
  test('renders nothing for an empty preview', () => {
    const CodePreview = makeCodePreview(writeFile, undefined, t)
    const preview: PreviewProps['preview'] = { kind: 'empty', name: 'empty.txt', size: 0 }

    const container = render(
      <CodePreview preview={preview} filePath="empty.txt" activeView="preview" t={t} />,
    )

    expect(container.querySelector('.dsh-cp')).toBeNull()
    expect(container.textContent).toBe('')
  })

  test('shows an upgrade prompt for a binary preview when readRaw is unavailable', () => {
    const CodePreview = makeCodePreview(writeFile, undefined, t)
    const preview: PreviewProps['preview'] = { kind: 'binary', name: 'x.bin', size: 4, bytes: '00 00', truncated: false }

    const container = render(
      <CodePreview preview={preview} filePath="x.bin" activeView="preview" t={t} />,
    )

    // No CodeMirror editor is mounted; the upgrade hint is surfaced instead.
    expect(container.querySelector('.cm-editor')).toBeNull()
    expect(container.querySelector('.dsh-cp')).not.toBeNull()
    expect(container.textContent).toContain('upgrade dsh-file-explorer')
  })

  test('shows an upgrade prompt for a text-large preview when readRaw is unavailable', () => {
    const CodePreview = makeCodePreview(writeFile, undefined, t)
    const preview: PreviewProps['preview'] = { kind: 'text-large', name: 'big.ts', extension: 'ts', size: 3 * 1024 * 1024 }

    const container = render(
      <CodePreview preview={preview} filePath="big.ts" activeView="preview" t={t} />,
    )

    // No CodeMirror editor is mounted; the upgrade hint is surfaced instead of
    // falling through to an empty editor frame.
    expect(container.querySelector('.cm-editor')).toBeNull()
    expect(container.querySelector('.dsh-cp')).not.toBeNull()
    expect(container.textContent).toContain('upgrade dsh-file-explorer')
  })
})
