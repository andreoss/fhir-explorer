import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i

function filesUnder(where: string, ending: string): string[] {
  return readdirSync(where).flatMap((name) => {
    const path = join(where, name)

    if (statSync(path).isDirectory()) {
      return filesUnder(path, ending)
    }

    return path.endsWith(ending) ? [path] : []
  })
}

const style = readFileSync('src/style.css', 'utf8')

describe('the one place the look is decided', () => {
  it('names a scale for type, space and colour', () => {
    for (const token of ['--t-body', '--t-title', '--s1', '--s5', '--ink', '--paper', '--accent', '--line']) {
      expect({ token, found: style.includes(`${token}:`) }).toEqual({ token, found: true })
    }
  })

  it('writes no colour anywhere but where colours are kept', () => {
    const elsewhere = style
      .replace(/^:root \{[\s\S]*?\n\}/m, '')
      .replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}/, '')

    expect(elsewhere.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([])
  })

  it('says what a label on a filled control is to be', () => {
    expect(style).toContain('--on-accent:')
    expect(style).not.toContain('color: #ffffff')
  })

  it('says how it reads in the dark as well as the light', () => {
    expect(style).toContain('prefers-color-scheme: dark')
  })

  it('shows where the keyboard is', () => {
    expect(style).toContain(':focus-visible')
  })

  it('sizes a control by what it says', () => {
    expect(style).toContain('inline-size: fit-content')
  })

  it('names no side of the page a language might read from the other end', () => {
    for (const physical of ['margin-left', 'margin-right', 'padding-left', 'padding-right', 'text-align: left']) {
      expect({ physical, found: style.includes(physical) }).toEqual({ physical, found: false })
    }
  })
})

describe('what a view is allowed to decide', () => {
  it('leaves every colour to the stylesheet', () => {
    const wrong = filesUnder('src', '.tsx')
      .filter((path) => !path.endsWith('.test.tsx'))
      .flatMap((path) => {
        const lines = readFileSync(path, 'utf8').split('\n')

        return lines.flatMap((line, at) => (COLOUR.test(line) ? [`${path}:${String(at + 1)}`] : []))
      })

    expect(wrong).toEqual([])
  })
})

describe('the same interface in the dark', () => {
  const dark = /@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}/.exec(style)?.[1] ?? ''

  it('says again in the dark every colour it said in the light', () => {
    const light = /^:root \{([\s\S]*?)\n\}/m.exec(style)?.[1] ?? ''
    const colours = [...light.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{3,8}|rgb)/gi)].map((found) => found[1])

    expect(colours.length).toBeGreaterThan(6)

    for (const token of colours) {
      expect({ token, said: dark.includes(`${String(token)}:`) }).toEqual({ token, said: true })
    }
  })

  it('does not say the scales twice', () => {
    expect(dark).not.toContain('--s1:')
    expect(dark).not.toContain('--t-body:')
  })
})

describe('the interface at the width of a telephone', () => {
  it('says what it does differently when there is less room', () => {
    expect(style).toContain('@media (max-width: 40rem)')
  })

  it('lets a wide table scroll rather than push the page sideways', () => {
    expect(style).toContain('.scrolls')
    expect(style).toContain('overflow-x: auto')
  })

  it('gives a field the whole width when the width is small', () => {
    const narrow = /@media \(max-width: 40rem\) \{([\s\S]*)\n\}/.exec(style)?.[1] ?? ''

    expect(narrow).toContain('inline-size: 100%')
    expect(narrow).toContain('grid-template-columns: 1fr')
  })
})
