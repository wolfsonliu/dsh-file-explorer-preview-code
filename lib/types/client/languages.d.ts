import { LanguageDescription } from '@codemirror/language';
/**
 * Resolve the CodeMirror language description for a file name (basename), or
 * null when no language matches. Matching is synchronous and pure; the actual
 * `LanguageSupport` is loaded asynchronously via {@link LanguageDescription.load}
 * by the caller.
 *
 * Uses the basename (not a full path) so exact-filename rules still match
 * (e.g. dotfiles) while extension rules match via suffix.
 */
export declare function languageDescriptionFor(fileName: string): LanguageDescription | null;
