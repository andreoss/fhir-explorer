import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PHYSICAL = [
  'margin-left',
  'margin-right',
  'padding-left',
  'padding-right',
  'border-left',
  'border-right',
  'text-align: left',
  'text-align: right',
  'left:',
  'right:'
]

describe('the way a page is laid out', () => {
  it('names no side of the page a language might read from the other end', () => {
    const style = readFileSync('src/style.css', 'utf8')

    for (const physical of PHYSICAL) {
      expect({ physical, found: style.includes(physical) }).toEqual({ physical, found: false })
    }
  })

  it('does say where things start and end instead', () => {
    const style = readFileSync('src/style.css', 'utf8')

    expect(style).toContain('padding-inline')
    expect(style).toContain('text-align: start')
  })
})
