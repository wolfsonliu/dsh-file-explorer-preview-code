import { describe, expect, test } from 'vitest'
import { languageDescriptionFor } from '../src/client/languages.ts'

describe('languageDescriptionFor', () => {
  test('maps code extensions to their CodeMirror language', () => {
    expect(languageDescriptionFor('index.ts')?.name).toBe('TypeScript')
    expect(languageDescriptionFor('index.tsx')?.name).toBe('TSX')
    expect(languageDescriptionFor('index.js')?.name).toBe('JavaScript')
    expect(languageDescriptionFor('index.jsx')?.name).toBe('JSX')
    expect(languageDescriptionFor('data.json')?.name).toBe('JSON')
    expect(languageDescriptionFor('style.css')?.name).toBe('CSS')
    expect(languageDescriptionFor('index.html')?.name).toBe('HTML')
    expect(languageDescriptionFor('main.py')?.name).toBe('Python')
    expect(languageDescriptionFor('config.yaml')?.name).toBe('YAML')
    expect(languageDescriptionFor('config.yml')?.name).toBe('YAML')
    expect(languageDescriptionFor('config.toml')?.name).toBe('TOML')
    expect(languageDescriptionFor('run.sh')?.name).toBe('Shell')
    expect(languageDescriptionFor('main.go')?.name).toBe('Go')
    expect(languageDescriptionFor('lib.rs')?.name).toBe('Rust')
    expect(languageDescriptionFor('Main.java')?.name).toBe('Java')
    expect(languageDescriptionFor('main.c')?.name).toBe('C')
    expect(languageDescriptionFor('main.cpp')?.name).toBe('C++')
    expect(languageDescriptionFor('header.h')?.name).toBe('C')
    expect(languageDescriptionFor('doc.xml')?.name).toBe('XML')
    expect(languageDescriptionFor('query.sql')?.name).toBe('SQL')
    expect(languageDescriptionFor('settings.ini')?.name).toBe('Properties files')
  })

  test('matches exact filenames via basename (not extension)', () => {
    expect(languageDescriptionFor('Dockerfile')?.name).toBe('Dockerfile')
  })

  test('returns null for extensions with no language support', () => {
    expect(languageDescriptionFor('.env')).toBeNull()
    expect(languageDescriptionFor('schema.graphql')).toBeNull()
    expect(languageDescriptionFor('thing.zzz')).toBeNull()
  })
})
