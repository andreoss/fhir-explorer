import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json, stubHttp } from '@lib/stub'
import { App } from './app'
import { testEnvironment } from './shell/environment'

const discovery = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: ['openid'],
  capabilities: ['launch-standalone']
}

describe('app', () => {
  it('renders the shell and its frame', () => {
    const screen = render(() => <App environment={testEnvironment()} />)

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Choose a server' })).toBeInTheDocument()
    expect(screen.getByRole('main').getAttribute('dir')).toBe('ltr')
  })

  it('connects to the address it is given', async () => {
    const stub = stubHttp([
      json(200, discovery),
      json(200, { resourceType: 'CapabilityStatement', fhirVersion: '4.0.1' })
    ])
    const screen = render(() => <App environment={testEnvironment({ http: stub.http })} />)

    const address: HTMLInputElement = screen.getByLabelText('Server address')
    address.value = 'https://example.org/fhir'
    address.dispatchEvent(new Event('input', { bubbles: true }))
    screen.getByText('Connect').click()

    await waitFor(() => {
      expect(screen.getByTestId('standing').textContent).toBe('Answering')
    })
  })

  it('shows what went wrong in one place', async () => {
    const stub = stubHttp([json(404, {})])
    const screen = render(() => <App environment={testEnvironment({ http: stub.http })} />)

    const address: HTMLInputElement = screen.getByLabelText('Server address')
    address.value = 'https://example.org/fhir'
    address.dispatchEvent(new Event('input', { bubbles: true }))
    screen.getByText('Connect').click()

    expect(await screen.findByRole('complementary', { name: 'What went wrong' })).toBeInTheDocument()
    expect(screen.getByText(/discovery document/)).toBeInTheDocument()
  })

  it('finishes a launch that came back and returns where it was', async () => {
    const stub = stubHttp([json(200, { access_token: 'abc', expires_in: 300 })])
    const cleaned: string[] = []
    const hashes: string[] = []
    const environment = testEnvironment({
      http: stub.http,
      replace: (url) => cleaned.push(url),
      setHash: (hash) => hashes.push(hash),
      here: () => new URL('https://explorer.example.org/?code=a&state=s')
    })

    environment.session.setItem(
      'fhir-explorer.launch',
      JSON.stringify({
        state: 's',
        verifier: 'v'.repeat(64),
        server: 'https://example.org/fhir',
        clientId: 'explorer',
        redirect: 'https://explorer.example.org/',
        token: 'https://issuer.example.org/token',
        returnTo: '#/'
      })
    )

    render(() => <App environment={environment} />)

    await waitFor(() => {
      expect(cleaned[0]).toBe('https://explorer.example.org/')
    })
    expect(hashes[0]).toBe('#/')
  })
})
