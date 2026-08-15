import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { basicSetup, EditorView } from 'codemirror';
import { Compartment } from '@codemirror/state';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { oneDark, oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { languageDescriptionFor } from "./languages.js";
const AUTOSAVE_DELAY_MS = 500;
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
 * method and the plugin's own translator (the PreviewProps `t` is bound to the
 * file-explorer namespace, not ours).
 */
export function makeCodePreview(writeFile, t) {
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
        const saveNow = useCallback(() => {
            const view = viewRef.current;
            if (view === null)
                return;
            if (saveTimerRef.current !== undefined) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = undefined;
            }
            // Capture the path/content synchronously so an in-flight save always
            // targets the file it was triggered for, even across file switches.
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
        useEffect(() => {
            if (preview.kind !== 'text')
                return;
            const container = containerRef.current;
            if (container === null)
                return;
            const name = preview.name;
            const content = preview.content;
            disposedRef.current = false;
            generationRef.current += 1;
            setSaveState('clean');
            setCursor({ line: 1, column: 1 });
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
            // Resolve the language synchronously (matching), then load its support
            // asynchronously and reconfigure the language compartment when ready.
            const description = languageDescriptionFor(name);
            setLanguageName(description?.name ?? t('plainText'));
            if (description !== null) {
                void description.load().then((support) => {
                    if (disposedRef.current || viewRef.current !== view)
                        return;
                    view.dispatch({ effects: langCompartmentRef.current.reconfigure(support) });
                });
            }
            // Follow DSH's dark/light toggle live.
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
            return () => {
                disposedRef.current = true;
                // Flush a pending autosave so a fast file switch doesn't lose the last edits.
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
        }, [filePath, preview, saveNow, t]);
        if (preview.kind !== 'text')
            return null;
        const saveLabel = {
            clean: '',
            dirty: t('unsaved'),
            saving: t('saving'),
            saved: t('saved'),
            error: t('saveFailed'),
        };
        return (_jsxs("div", { className: "dsh-cp", children: [_jsx("div", { className: "dsh-cp-editor", ref: containerRef }), _jsxs("div", { className: "dsh-cp-status", children: [_jsx("span", { className: "dsh-cp-lang", children: languageName }), _jsxs("span", { className: "dsh-cp-pos", children: ["Ln ", cursor.line, ", Col ", cursor.column] }), _jsx("span", { className: `dsh-cp-save dsh-cp-save--${saveState}`, children: saveLabel[saveState] }), _jsx("button", { className: "dsh-cp-save-btn", type: "button", onClick: saveNow, disabled: saveState === 'clean' || saveState === 'saving', children: t('save') })] })] }));
    };
}
