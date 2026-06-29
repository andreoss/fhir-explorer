import { Route } from '@solidjs/router'
import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { renderUnder } from '../test/view'
import { json, routedHttp } from '@lib/stub'
import type { HttpResponse } from '@lib/transport'
import { testEnvironment } from './environment'
import { useConnection } from './server'
import { SessionNeeded } from './session'

const discovery = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: ['openid'],
  capabilities: []
}

const statement = { resourceType: 'CapabilityStatement', fhirVersion: '4.0.1' }

function mount(hash: string, answers: readonly (readonly [string, HttpResponse | Error])[] = [], now = 0) {
  const gone: string[] = []
  let clock = now
  const stub = routedHttp([
    ['.well-known/smart-configuration', json(200, discovery)],
    ['/metadata', json(200, statement)],
    ...answers
  ])
  const environment = testEnvironment({
    http: stub.http,
    go: (url) => gone.push(url),
    now: () => clock,
    heartbeat: 10
  })
  let connection: ReturnType<typeof useConnection> | undefined

  function Reach() {
    connection = useConnection()

    return <SessionNeeded />
  }

  globalThis.location.hash = hash

  const screen = renderUnder(environment, () => (
      <>
<Route path="*" component={Reach} />
      </>
    ))

  return {
    screen,
    gone,
    stub,
    pass: (by: number) => {
      clock += by
    },
    reach: () => {
      if (connection === undefined) {
        throw new Error('nothing was mounted')
      }

      return connection
    }
  }
}

describe('a page that needs a session', () => {
  it('says so, once the server is known', async () => {
    const mounted = mount('#/type/Patient/p1')

    await mounted.reach().connect('https://example.org/fhir')

    await waitFor(() => {
      expect(mounted.screen.getByTestId('needed')).toBeInTheDocument()
    })
  })

  it('says nothing on the page where a session is started', async () => {
    const mounted = mount('#/')

    await mounted.reach().connect('https://example.org/fhir')

    await waitFor(() => {
      expect(mounted.screen.queryByTestId('needed')).not.toBeInTheDocument()
    })
  })

  it('says nothing before a server has been reached', () => {
    const mounted = mount('#/type/Patient/p1')

    expect(mounted.screen.queryByTestId('needed')).not.toBeInTheDocument()
  })

  it('comes back to the page it was asked from', async () => {
    const mounted = mount('#/type/Patient/p1')

    await mounted.reach().connect('https://example.org/fhir')
    await waitFor(() => {
      expect(mounted.screen.getByTestId('needed')).toBeInTheDocument()
    })

    mounted.screen.getByText('Sign in').click()

    await waitFor(() => {
      expect(mounted.gone[0]).toContain('issuer.example.org')
    })
    expect(mounted.reach().pendingReturn()).toBe('#/type/Patient/p1')
  })
})

describe('a session that ran out', () => {
  const session = {
    access_token: 'abc',
    expires_in: 300,
    refresh_token: 'refresh',
    token_type: 'Bearer'
  }

  async function signedIn(later: number) {
    const mounted = mount('#/type/Patient/p1', [['issuer.example.org/token', json(200, session)]], 0)

    await mounted.reach().connect('https://example.org/fhir')
    await mounted.reach().signIn('#/type/Patient/p1')

    const state = new URL(mounted.gone[0] ?? '').searchParams.get('state') ?? ''

    await mounted.reach().complete({ code: 'code', state })
    mounted.pass(later)

    return mounted
  }

  it('says so where a reader can see it', async () => {
    const mounted = await signedIn(1_000_000)

    await waitFor(() => {
      expect(mounted.screen.getByTestId('ran-out')).toBeInTheDocument()
    })
  })

  it('says nothing while a session still has time', async () => {
    const mounted = await signedIn(0)

    await waitFor(() => {
      expect(mounted.screen.queryByTestId('needed')).not.toBeInTheDocument()
    })
    expect(mounted.screen.queryByTestId('ran-out')).not.toBeInTheDocument()
  })

  it('is renewed without leaving the page', async () => {
    const mounted = await signedIn(1_000_000)

    await waitFor(() => {
      expect(mounted.screen.getByTestId('ran-out')).toBeInTheDocument()
    })

    mounted.screen.getByText('Renew the session').click()

    await waitFor(() => {
      expect(mounted.stub.requests.filter((request) => request.method === 'POST').length).toBeGreaterThan(1)
    })
  })
})
