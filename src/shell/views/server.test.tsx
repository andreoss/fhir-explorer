import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json, stubHttp } from '@lib/stub'
import type { HttpResponse } from '@lib/transport'
import { TroubleProvider } from '../errors'
import { testEnvironment } from '../environment'
import { ConnectionProvider } from '../server'
import { TextProvider } from '../text'
import { ServerView } from './server'

const discovery = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: ['openid'],
  capabilities: ['launch-standalone']
}

function mount(answers: (HttpResponse | Error)[] = [], gone: string[] = []) {
  const stub = stubHttp(answers)
  const environment = testEnvironment({ http: stub.http, go: (url) => gone.push(url) })

  return render(() => (
    <TextProvider>
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <ServerView />
        </ConnectionProvider>
      </TroubleProvider>
    </TextProvider>
  ))
}

function type(screen: ReturnType<typeof mount>, address: string) {
  const field: HTMLInputElement = screen.getByLabelText('Server address')

  field.value = address
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('the server view', () => {
  it('asks for an address and offers to connect', () => {
    const screen = mount()

    expect(screen.getByLabelText('Server address')).toBeInTheDocument()
    expect(screen.getByText('Connect')).toBeInTheDocument()
  })

  it('will not start a session against a server it has not reached', () => {
    const screen = mount()

    expect(screen.getByText('Sign in')).toBeDisabled()
  })

  it('offers to start a session once a server has said how', async () => {
    const screen = mount([json(200, discovery), json(200, { resourceType: 'CapabilityStatement' })])

    type(screen, 'https://example.org/fhir')
    screen.getByText('Connect').click()

    await waitFor(() => {
      expect(screen.getByText('Sign in')).toBeEnabled()
    })
  })

  it('sends the browser to the issuer when asked to sign in', async () => {
    const gone: string[] = []
    const screen = mount([json(200, discovery), json(200, { resourceType: 'CapabilityStatement' })], gone)

    type(screen, 'https://example.org/fhir')
    screen.getByText('Connect').click()
    await waitFor(() => {
      expect(screen.getByText('Sign in')).toBeEnabled()
    })
    screen.getByText('Sign in').click()

    await waitFor(() => {
      expect(gone[0]).toContain('issuer.example.org/authorize')
    })
  })
})

describe('a reader who has been here before', () => {
  it('says what this is and what to do', () => {
    const screen = mount()

    expect(screen.getByText(/builds itself from what that server declares/)).toBeInTheDocument()
    expect(screen.getByText(/sign in through the issuer/)).toBeInTheDocument()
  })

  it('offers nothing before any server has answered', () => {
    const screen = mount()

    expect(screen.queryByTestId('before')).not.toBeInTheDocument()
  })

  it('offers the servers that have answered before', async () => {
    const screen = mount([json(200, discovery), json(200, { resourceType: 'CapabilityStatement' })])

    type(screen, 'https://example.org/fhir')
    screen.getByText('Connect').click()

    await waitFor(() => {
      expect(screen.getByTestId('before')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'https://example.org/fhir' })).toBeInTheDocument()
  })

  it('forgets one when asked', async () => {
    const screen = mount([json(200, discovery), json(200, { resourceType: 'CapabilityStatement' })])

    type(screen, 'https://example.org/fhir')
    screen.getByText('Connect').click()
    await waitFor(() => {
      expect(screen.getByTestId('before')).toBeInTheDocument()
    })

    screen.getByLabelText('Forget https://example.org/fhir').click()

    await waitFor(() => {
      expect(screen.queryByTestId('before')).not.toBeInTheDocument()
    })
  })
})

describe('a control a reader cannot use yet', () => {
  it('says what would make it usable', async () => {
    const mounted = mount([])

    await waitFor(() => {
      expect(mounted.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    })
    expect(mounted.getByTestId('first')).toBeInTheDocument()
  })
})

