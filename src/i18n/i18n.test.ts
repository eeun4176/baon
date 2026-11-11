// @vitest-environment node
/// <reference types="node" />
/*
 * i18n.test.ts — Every tr('…') text in the app has a Filipino translation with the same {0}, {1}…
 * slots, every tr() call uses a plain text (so it can be checked here), and the dictionary
 * has no leftovers. Run: npm test
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { FIL } from './fil.ts'
import { tr } from './i18n.ts'

/** Every source file under src (no tests). */
function sources(dir = 'src'): string[] {
  return fs.readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return fs.statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : []
  })
}

/** All tr() texts, plus calls whose text isn't a plain string (can't be checked). */
function collect() {
  const keys = new Map<string, string>()
  const dynamic: string[] = []
  for (const file of sources()) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tr' && n.arguments.length) {
        const a = n.arguments[0]
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) keys.set(a.text, file)
        else dynamic.push(`${file}: ${n.getText().slice(0, 60)}`)
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return { keys, dynamic }
}

const slots = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join(' ')

describe('Filipino', () => {
  const { keys, dynamic } = collect()

  it('every tr() uses a plain text', () => {
    expect(dynamic).toEqual([])
  })

  it('every text has a translation', () => {
    expect([...keys.keys()].filter((k) => !(k in FIL))).toEqual([])
  })

  it('translations keep the same {0}, {1}… slots', () => {
    expect(Object.entries(FIL).filter(([en, fil]) => slots(en) !== slots(fil)).map(([en]) => en)).toEqual([])
  })

  it('no leftover translations for text the app no longer has', () => {
    expect(Object.keys(FIL).filter((k) => !keys.has(k))).toEqual([])
  })

  it('fills slots in any order (English here)', () => {
    expect(tr('{0} left of {1} this cycle', '₱30', '₱200')).toBe('₱30 left of ₱200 this cycle')
    expect(tr('Save|savings tab')).toBe('Save')
    expect(tr('{0} | Baon Student Budget Tracker', 'Plan')).toBe('Plan | Baon Student Budget Tracker')
  })
})
