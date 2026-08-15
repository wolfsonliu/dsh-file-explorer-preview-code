/** Shared constants for the code-preview plugin. */

/** Package id stamped into the client bundle handoff and locale namespace. */
export const PLUGIN_ID = '@dsh-external/dsh-file-explorer-preview-code'

/**
 * File extensions (lowercase, no leading dot) whose plain-text preview this
 * plugin overrides with a CodeMirror editor at priority 10.
 */
export const CODE_EXTS = [
  'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py',
  'yaml', 'yml', 'toml', 'env', 'sh', 'go', 'rs', 'java',
  'c', 'cpp', 'h', 'xml', 'sql', 'graphql', 'cfg', 'ini',
]
