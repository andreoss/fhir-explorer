import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json, routedHttp } from '@lib/stub'
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
  fhirVersion: '4.0.1',
  rest: [{ mode: 'server', resource: [{ type: 'Patient', interaction: [{ code: 'read' }] }] }]
}

function said(container: HTMLElement): readonly string[] {
  return [...container.querySelectorAll('span, p, a, button, h1, h2, summary')]
    .map((element) => (element.children.length === 0 ? element.textContent.trim() : ''))
    .filter((text) => text.length > 2)
}

function mount() {
  const stub = routedHttp([
    ['.well-known/smart-configuration', json(200, discovery)],
    ['/metadata', json(200, statement)]
  ])

  return render(() => <App environment={testEnvironment({ http: stub.http })} />)
}

describe('a page that says a thing once', () => {
  it('does not say the same thing twice before a server is chosen', () => {
    const screen = mount()
    const twice = said(screen.container).filter((text, at, all) => all.indexOf(text) !== at)

    expect(twice).toEqual([])
  })

  it('says there is no server rather than no session', () => {
    const screen = mount()

    expect(screen.getByTestId('standing').textContent).toBe('No server yet')
    expect(screen.getByTestId('session').textContent).toBe('No session')
  })
})

describe('a control that cannot be used', () => {
  it('does not carry the weight of one that can', () => {
    const screen = mount()
    const signIn = screen.getByText('Sign in')

    expect(signIn).toBeDisabled()
  })

  it('carries it again once it can be used', async () => {
    const screen = mount()
    const field: HTMLInputElement = screen.getByLabelText('Server address')

    field.value = 'https://example.org/fhir'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    screen.getByText('Connect').click()

    await waitFor(() => {
      expect(screen.getByText('Sign in')).toBeEnabled()
    })
  })
})
