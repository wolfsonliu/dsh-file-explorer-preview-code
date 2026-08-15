const id = '@dsh-external/dsh-file-explorer-preview-code'
const platformModules = [
  '@deepseek-ai/dsh-client-runtime/client',
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
]

export default [{
  // Node half: a minimal no-op cordis plugin so the host Loader can import
  // this roster entry. There are no host responsibilities (no server route).
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}, {
  // Browser half: the client bundle. CodeMirror and every @codemirror/*
  // language package are inlined; react/react-dom/client-runtime stay external.
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: platformModules,
    alwaysBundle: mod => platformModules.includes(mod) ? undefined : true,
    onlyBundle: false,
  },
  outputOptions: {
    entryFileNames: 'client.js',
    // @codemirror/language-data lazy-loads languages via dynamic import(); a
    // single client.js must inline them (no separate chunks).
    codeSplitting: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}]
