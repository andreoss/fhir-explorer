import { describe, expect, it } from 'vitest'
import { styleOf, tokens } from './cytoscape'

function painted(colours: Readonly<Record<string, string>>): HTMLElement {
  const element = document.createElement('div')

  for (const [name, value] of Object.entries(colours)) {
    element.style.setProperty(name, value)
  }

  document.body.append(element)

  return element
}

describe('what the drawing takes from the page', () => {
  it('takes every colour it draws with from the stylesheet', () => {
    const held = tokens(
      painted({
        '--accent': 'rgb(1, 2, 3)',
        '--quiet': 'rgb(4, 5, 6)',
        '--alarm': 'rgb(7, 8, 9)',
        '--line': 'rgb(10, 11, 12)',
        '--raised': 'rgb(13, 14, 15)',
        '--ink': 'rgb(16, 17, 18)'
      })
    )

    expect(held).toEqual({
      read: 'rgb(1, 2, 3)',
      unread: 'rgb(4, 5, 6)',
      focus: 'rgb(7, 8, 9)',
      line: 'rgb(10, 11, 12)',
      paper: 'rgb(13, 14, 15)',
      ink: 'rgb(16, 17, 18)'
    })
  })

  it('falls back to something visible where a page says nothing', () => {
    const held = tokens(painted({}))

    expect(Object.values(held).every((colour) => colour.length > 0)).toBe(true)
  })

  it('draws what was read differently from what was not, and the one in focus differently again', () => {
    const style = styleOf({
      read: 'read',
      unread: 'unread',
      focus: 'focus',
      line: 'line',
      paper: 'paper',
      ink: 'ink'
    })

    const node = style.find((one) => one.selector === 'node')
    const loaded = style.find((one) => one.selector === 'node[?loaded]')
    const chosen = style.find((one) => one.selector === 'node:selected')
    const edge = style.find((one) => one.selector === 'edge')

    expect(node?.style['background-color']).toBe('unread')
    expect(loaded?.style['background-color']).toBe('read')
    expect(chosen?.style['background-color']).toBe('focus')
    expect(edge?.style['line-color']).toBe('unread')
  })

  it('keeps a label from covering the drawing under it', () => {
    const node = styleOf({ read: 'a', unread: 'b', focus: 'c', line: 'd', paper: 'e', ink: 'f' }).find(
      (one) => one.selector === 'node'
    )

    expect(node?.style['text-wrap']).toBe('ellipsis')
    expect(node?.style['text-max-width']).toBe('140px')
    expect(node?.style['text-background-color']).toBe('e')
  })
})

describe('a drawing that can be made out', () => {
  it('draws a node and an edge large enough to see', () => {
    const style = styleOf(tokens(document.createElement('div')))
    const node = style.find((rule) => rule.selector === 'node')
    const edge = style.find((rule) => rule.selector === 'edge')

    expect(node?.style.width ?? 0).toBeGreaterThanOrEqual(24)
    expect(node?.style['font-size'] ?? 0).toBeGreaterThanOrEqual(12)
    expect(edge?.style.width ?? 0).toBeGreaterThanOrEqual(2)
  })
})

