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
  test('returns null for a non-text preview without mounting CodeMirror', () => {
    const CodePreview = makeCodePreview(writeFile, t)
    const preview: PreviewProps['preview'] = { kind: 'binary', name: 'x.bin', size: 4 }

    const container = render(
      <CodePreview preview={preview} filePath="x.bin" activeView="preview" t={t} />,
    )

    expect(container.querySelector('.dsh-cp')).toBeNull()
    expect(container.textContent).toBe('')
  })
})
