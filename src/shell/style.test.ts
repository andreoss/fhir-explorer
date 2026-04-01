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
