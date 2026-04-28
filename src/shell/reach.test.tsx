import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { json, routedHttp } from '../test/http'
import { App } from '../app'
import { testEnvironment } from './environment'

const discovery = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: [],
  capabilities: []
}

const statement = {
  resourceType: 'CapabilityStatement',
  rest: [{ mode: 'server', resource: [{ type: 'Patient', interaction: [{ code: 'read' }] }] }]
}

function mount() {
  const stub = routedHttp([
    ['.well-known/smart-configuration', json(200, discovery)],
    ['/metadata', json(200, statement)]
  ])

  return render(() => <App environment={testEnvironment({ http: stub.http })} />)
}

describe('a reader who never touches a pointing device', () => {
  it('is offered the content before anything else', () => {
    const screen = mount()
    const first = screen.container.querySelector('a, button, input, select, textarea')

    expect(first?.textContent).toBe('Skip to the content')
    expect(first?.getAttribute('href')).toBe('#content')
  })

  it('has somewhere for that to take them', () => {
    const screen = mount()

    expect(screen.container.querySelector('#content')).toBeInTheDocument()
  })

  it('can reach every action on the first page from the keyboard', () => {
    const screen = mount()
    const reachable = [...screen.container.querySelectorAll('a, button, input, select')].filter(
      (element) => element.getAttribute('tabindex') !== '-1'
    )

    expect(reachable.length).toBeGreaterThan(3)
    expect(reachable.every((element) => !element.hasAttribute('disabled') || element.tagName === 'BUTTON')).toBe(true)
  })
})

describe('a page that holds its place', () => {
  it('keeps room for what it is about to say', async () => {
    const screen = mount()

    globalThis.location.hash = '#/types'

    await waitFor(() => {
      expect(screen.container.querySelector('#content')).toBeInTheDocument()
    })
  })

  it('reserves the room rather than making it later', () => {
    const style = readFileSync('src/style.css', 'utf8')

    expect(style).toContain('.busy {')
    expect(style).toContain('min-block-size')
  })
})
