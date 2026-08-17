import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { basicSetup, EditorView } from 'codemirror';
import { Compartment } from '@codemirror/state';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { oneDark, oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { languageDescriptionFor } from "./languages.js";
const AUTOSAVE_DELAY_MS = 500;
const TEXT_DECODER = new TextDecoder('utf-8');
/**
 * Pick the full theme (editor chrome + syntax tokens) following DSH's
 * dark-theme attribute. The full `oneDark` base theme darkens the gutter and
 * line numbers, not just the syntax tokens.
 */
function currentThemeExtension() {
    return document.body.hasAttribute('data-ds-dark-theme')
        ? [oneDark, syntaxHighlighting(oneDarkHighlightStyle)]
        : [syntaxHighlighting(defaultHighlightStyle)];
}
/**
 * Create the code preview component, closing over the `writeFile` service
 * method, `readRaw` for large/binary files, and the plugin's own translator.
 */
export function makeCodePreview(writeFile, readRaw, t) {
    return function CodePreview(props) {
        const { preview, filePath } = props;
        const containerRef = useRef(null);
        const viewRef = useRef(null);
        const langCompartmentRef = useRef(new Compartment());
        const themeCompartmentRef = useRef(new Compartment());
        const saveTimerRef = useRef(undefined);
        const saveChainRef = useRef(Promise.resolve());
        const disposedRef = useRef(true);
        const generationRef = useRef(0);
        const filePathRef = useRef(filePath);
        filePathRef.current = filePath;
        const [saveState, setSaveState] = useState('clean');
        const [languageName, setLanguageName] = useState(t('plainText'));
        const [cursor, setCursor] = useState({ line: 1, column: 1 });
        const [loading, setLoading] = useState(false);
        const [loadError, setLoadError] = useState(null);
        const saveNow = useCallback(() => {
            const view = viewRef.current;
            if (view === null)
                return;
            if (saveTimerRef.current !== undefined) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = undefined;
            }
            const path = filePathRef.current;
            const generation = generationRef.current;
            const content = view.state.doc.toString();
            setSaveState('saving');
            saveChainRef.current = saveChainRef.current
                .then(() => writeFile(path, content))
                .then(() => {
                if (!disposedRef.current && generationRef.current === generation)
                    setSaveState('saved');
            })
                .catch(() => {
                if (!disposedRef.current && generationRef.current === generation)
                    setSaveState('error');
            });
        }, [writeFile]);
        /**
         * Create the CodeMirror editor inside `container`, populate it with
         * `content`, resolve the language from `fileName`, and wire up the
         * mutation observer + Ctrl/Cmd+S handler. Returns the EditorView.
         */
        const setupEditor = useCallback((container, content, fileName) => {
            disposedRef.current = false;
            generationRef.current += 1;
            setSaveState('clean');
            setCursor({ line: 1, column: 1 });
            setLoading(false);
            setLoadError(null);
            const view = new EditorView({
                parent: container,
                doc: content,
                extensions: [
                    basicSetup,
                    EditorView.lineWrapping,
                    langCompartmentRef.current.of([]),
                    themeCompartmentRef.current.of(currentThemeExtension()),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            setSaveState('dirty');
                            if (saveTimerRef.current !== undefined)
                                window.clearTimeout(saveTimerRef.current);
                            saveTimerRef.current = window.setTimeout(saveNow, AUTOSAVE_DELAY_MS);
                        }
                        if (update.selectionSet || update.docChanged) {
                            const head = update.state.selection.main.head;
                            const line = update.state.doc.lineAt(head);
                            setCursor({ line: line.number, column: head - line.from + 1 });
                        }
                    }),
                ],
            });
            viewRef.current = view;
            const description = languageDescriptionFor(fileName);
            setLanguageName(description?.name ?? t('plainText'));
            if (description !== null) {
                void description.load().then((support) => {
                    if (disposedRef.current || viewRef.current !== view)
                        return;
                    view.dispatch({ effects: langCompartmentRef.current.reconfigure(support) });
                });
            }
            const observer = new MutationObserver(() => {
                if (disposedRef.current || viewRef.current !== view)
                    return;
                view.dispatch({ effects: themeCompartmentRef.current.reconfigure(currentThemeExtension()) });
            });
            observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
            const handleKeydown = (event) => {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                    event.preventDefault();
                    saveNow();
                }
            };
            container.addEventListener('keydown', handleKeydown);
            view.dom._cleanup = () => {
                disposedRef.current = true;
                if (saveTimerRef.current !== undefined) {
                    window.clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = undefined;
                    void writeFile(filePath, view.state.doc.toString()).catch(() => { });
                }
                container.removeEventListener('keydown', handleKeydown);
                observer.disconnect();
                view.destroy();
                viewRef.current = null;
            };
            return view;
        }, [saveNow, t, writeFile]);
        useEffect(() => {
            const container = containerRef.current;
            if (container === null)
                return;
            // Cleanup previous editor instance.
            const prevView = viewRef.current;
            if (prevView !== null) {
                const cleanup = prevView.dom._cleanup;
                if (cleanup)
                    cleanup();
            }
            if (preview.kind === 'empty')
                return;
            if (preview.kind === 'text') {
                setupEditor(container, preview.content, preview.name);
                return;
            }
            if (preview.kind === 'too-large' || preview.kind === 'binary') {
                if (!readRaw) {
                    setLoadError('File too large — upgrade dsh-file-explorer to preview this file');
                    return;
                }
                setLoading(true);
                setLoadError(null);
                readRaw(filePath)
                    .then((buffer) => {
                    if (disposedRef.current)
                        return;
                    const text = TEXT_DECODER.decode(buffer);
                    if (containerRef.current === null)
                        return;
                    setupEditor(containerRef.current, text, preview.name);
                })
                    .catch((err) => {
                    if (disposedRef.current)
                        return;
                    setLoading(false);
                    setLoadError(err instanceof Error ? err.message : 'Failed to read file');
                });
                return;
            }
            // image or unknown kind — nothing to render as text
        }, [filePath, preview, readRaw, setupEditor]);
        if (preview.kind === 'empty')
            return null;
        const saveLabel = {
            clean: '',
            dirty: t('unsaved'),
            saving: t('saving'),
            saved: t('saved'),
            error: t('saveFailed'),
        };
        // Loading state while readRaw is in-flight for large/binary files.
        if (loading) {
            return (_jsx("div", { className: "dsh-cp", children: _jsx("div", { className: "dsh-cp-editor", ref: containerRef, style: { display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dsw-alias-label-secondary, #777)', fontSize: '13px' }, children: "Loading\u2026" }) }));
        }
        // Error state: readRaw failed or unavailable.
        if (loadError !== null) {
            return (_jsx("div", { className: "dsh-cp", children: _jsx("div", { className: "dsh-cp-editor", ref: containerRef, style: { display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dsw-alias-state-error-primary, #d73535)', fontSize: '13px', padding: '16px' }, children: loadError }) }));
        }
        return (_jsxs("div", { className: "dsh-cp", children: [_jsx("div", { className: "dsh-cp-editor", ref: containerRef }), _jsxs("div", { className: "dsh-cp-status", children: [_jsx("span", { className: "dsh-cp-lang", children: languageName }), _jsxs("span", { className: "dsh-cp-pos", children: ["Ln ", cursor.line, ", Col ", cursor.column] }), _jsx("span", { className: `dsh-cp-save dsh-cp-save--${saveState}`, children: saveLabel[saveState] }), _jsx("button", { className: "dsh-cp-save-btn", type: "button", onClick: saveNow, disabled: saveState === 'clean' || saveState === 'saving', children: t('save') })] })] }));
    };
}
