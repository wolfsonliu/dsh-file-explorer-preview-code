import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { Compartment } from '@codemirror/state'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import type { PreviewProps, Translate } from '@dsh-external/dsh-file-explorer/client'
import { languageDescriptionFor } from './languages.ts'

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error'
type WriteFile = (path: string, content: string) => Promise<void>

const AUTOSAVE_DELAY_MS = 500

/** Pick the highlight theme following DSH's dark-theme attribute. */
function currentHighlightExtension() {
  return syntaxHighlighting(
    document.body.hasAttribute('data-ds-dark-theme') ? oneDarkHighlightStyle : defaultHighlightStyle,
  )
}

/**
 * Create the code preview component, closing over the `writeFile` service
 * method and the plugin's own translator (the PreviewProps `t` is bound to the
 * file-explorer namespace, not ours).
 */
export function makeCodePreview(writeFile: WriteFile, t: Translate): ComponentType<PreviewProps> {
  return function CodePreview(props: PreviewProps) {
    const { preview, filePath } = props

    const containerRef = useRef<HTMLDivElement | null>(null)
    const viewRef = useRef<EditorView | null>(null)
    const langCompartmentRef = useRef(new Compartment())
    const themeCompartmentRef = useRef(new Compartment())
    const saveTimerRef = useRef<number | undefined>(undefined)
    const saveChainRef = useRef<Promise<void>>(Promise.resolve())
    const disposedRef = useRef(true)
    const generationRef = useRef(0)
    const filePathRef = useRef(filePath)
    filePathRef.current = filePath

    const [saveState, setSaveState] = useState<SaveState>('clean')
    const [languageName, setLanguageName] = useState<string>(t('plainText'))
    const [cursor, setCursor] = useState({ line: 1, column: 1 })

    const saveNow = useCallback(() => {
      const view = viewRef.current
      if (view === null) return
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = undefined
      }
      // Capture the path/content synchronously so an in-flight save always
      // targets the file it was triggered for, even across file switches.
      const path = filePathRef.current
      const generation = generationRef.current
      const content = view.state.doc.toString()
      setSaveState('saving')
      saveChainRef.current = saveChainRef.current
        .then(() => writeFile(path, content))
        .then(() => {
          if (!disposedRef.current && generationRef.current === generation) setSaveState('saved')
        })
        .catch(() => {
          if (!disposedRef.current && generationRef.current === generation) setSaveState('error')
        })
    }, [writeFile])

    useEffect(() => {
      if (preview.kind !== 'text') return
      const container = containerRef.current
      if (container === null) return
      const name = preview.name
      const content = preview.content

      disposedRef.current = false
      generationRef.current += 1
      setSaveState('clean')
      setCursor({ line: 1, column: 1 })

      const view = new EditorView({
        parent: container,
        doc: content,
        extensions: [
          basicSetup,
          EditorView.lineWrapping,
          langCompartmentRef.current.of([]),
          themeCompartmentRef.current.of(currentHighlightExtension()),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setSaveState('dirty')
              if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current)
              saveTimerRef.current = window.setTimeout(saveNow, AUTOSAVE_DELAY_MS)
            }
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head
              const line = update.state.doc.lineAt(head)
              setCursor({ line: line.number, column: head - line.from + 1 })
            }
          }),
        ],
      })
      viewRef.current = view

      // Resolve the language synchronously (matching), then load its support
      // asynchronously and reconfigure the language compartment when ready.
      const description = languageDescriptionFor(name)
      setLanguageName(description?.name ?? t('plainText'))
      if (description !== null) {
        void description.load().then((support) => {
          if (disposedRef.current || viewRef.current !== view) return
          view.dispatch({ effects: langCompartmentRef.current.reconfigure(support) })
        })
      }

      // Follow DSH's dark/light toggle live.
      const observer = new MutationObserver(() => {
        if (disposedRef.current || viewRef.current !== view) return
        view.dispatch({ effects: themeCompartmentRef.current.reconfigure(currentHighlightExtension()) })
      })
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

      const handleKeydown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          saveNow()
        }
      }
      container.addEventListener('keydown', handleKeydown)

      return () => {
        disposedRef.current = true
        // Flush a pending autosave so a fast file switch doesn't lose the last edits.
        if (saveTimerRef.current !== undefined) {
          window.clearTimeout(saveTimerRef.current)
          saveTimerRef.current = undefined
          void writeFile(filePath, view.state.doc.toString()).catch(() => {})
        }
        container.removeEventListener('keydown', handleKeydown)
        observer.disconnect()
        view.destroy()
        viewRef.current = null
      }
    }, [filePath, preview, saveNow, t])

    if (preview.kind !== 'text') return null

    const saveLabel: Record<SaveState, string> = {
      clean: '',
      dirty: t('unsaved'),
      saving: t('saving'),
      saved: t('saved'),
      error: t('saveFailed'),
    }

    return (
      <div className="dsh-cp">
        <div className="dsh-cp-editor" ref={containerRef} />
        <div className="dsh-cp-status">
          <span className="dsh-cp-lang">{languageName}</span>
          <span className="dsh-cp-pos">Ln {cursor.line}, Col {cursor.column}</span>
          <span className={`dsh-cp-save dsh-cp-save--${saveState}`}>{saveLabel[saveState]}</span>
          <button
            className="dsh-cp-save-btn"
            type="button"
            onClick={saveNow}
            disabled={saveState === 'clean' || saveState === 'saving'}
          >
            {t('save')}
          </button>
        </div>
      </div>
    )
  }
}
