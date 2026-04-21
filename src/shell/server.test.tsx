import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json, stubHttp } from '../test/http'
import type { HttpResponse } from '../domain/transport/port'
import { TroubleProvider, useTroubles } from './errors'
import { testEnvironment } from './environment'
import { ConnectionProvider, useConnection } from './server'

const base = 'https://example.org/fhir'

const discovery = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: ['openid', 'patient/*.read'],
  capabilities: ['launch-standalone']
}

const statement = {
  resourceType: 'CapabilityStatement',
  fhirVersion: '4.0.1',
  software: { name: 'a server' },
  rest: [{ mode: 'server', resource: [{ type: 'Patient', interaction: [{ code: 'read' }] }] }]
}

function Shown(props: { readonly ready?: (connection: ReturnType<typeof useConnection>) => void }) {
  const connection = useConnection()
  const troubles = useTroubles()

  props.ready?.(connection)

  return (
    <div>
      <span data-testid="standing">{connection.standing()}</span>
      <span data-testid="release">{connection.capability()?.fhirVersion ?? ''}</span>
      <span data-testid="signed">{connection.signedIn() ? 'in' : 'out'}</span>
      <span data-testid="trouble">{troubles.all()[0]?.message ?? ''}</span>
    </div>
  )
}

function mount(answers: (HttpResponse | Error)[], gone: string[] = []) {
  const stub = stubHttp(answers)
  const environment = testEnvironment({
    http: stub.http,
    go: (url) => gone.push(url),
    now: () => 1_000
  })
  let connection: ReturnType<typeof useConnection> | undefined

  const screen = render(() => (
    <TroubleProvider>
      <ConnectionProvider environment={environment}>
        <Shown ready={(found) => (connection = found)} />
      </ConnectionProvider>
    </TroubleProvider>
  ))

  return {
    screen,
    stub,
    environment,
    connection: () => {
      if (connection === undefined) {
        throw new Error('nothing was mounted')
      }

      return connection
    },
    gone
  }
}

describe('connection', () => {
  it('starts knowing nothing', () => {
    const mounted = mount([])

    expect(mounted.screen.getByTestId('standing').textContent).toBe('idle')
  })

  it('asks a server what it can do, and reports the server', async () => {
    const mounted = mount([json(200, discovery), json(200, statement)])

    await mounted.connection().connect(`${base}/`)

    await waitFor(() => {
      expect(mounted.screen.getByTestId('standing').textContent).toBe('reachable')
    })
    expect(mounted.screen.getByTestId('release').textContent).toBe('4.0.1')
    expect(mounted.stub.requests[0]?.url).toBe(`${base}/.well-known/smart-configuration`)
    expect(mounted.stub.requests[1]?.url).toBe(`${base}/metadata`)
  })

  it('refuses a server that advertises no way in, and says so once', async () => {
    const mounted = mount([json(404, {})])

    await mounted.connection().connect(base)

    expect(mounted.screen.getByTestId('standing').textContent).toBe('unsupported')
    expect(mounted.screen.getByTestId('trouble').textContent).toContain('discovery')
  })

  it('reports a server that did not answer at all', async () => {
    const mounted = mount([new Error('down')])

    await mounted.connection().connect(base)

    expect(mounted.screen.getByTestId('standing').textContent).toBe('unreachable')
  })

  it('reports a server that answers discovery but not for itself', async () => {
    const mounted = mount([json(200, discovery), new Error('down')])

    await mounted.connection().connect(base)

    await waitFor(() => {
      expect(mounted.screen.getByTestId('standing').textContent).toBe('unreachable')
    })
    expect(mounted.screen.getByTestId('trouble').textContent).toBe('down')
  })

  it('sends the browser to the issuer, keeping where it was', async () => {
    const gone: string[] = []
    const mounted = mount([json(200, discovery), json(200, statement)], gone)

    await mounted.connection().connect(base)
    await mounted.connection().signIn('#/type/Patient')

    expect(gone[0]).toContain('https://issuer.example.org/authorize')
    expect(gone[0]).toContain('code_challenge_method=S256')
  })

  it('says nothing can be launched against a server it never reached', async () => {
    const mounted = mount([])

    await mounted.connection().signIn('#/')

    expect(mounted.screen.getByTestId('trouble').textContent).toContain('session')
  })

  it('finishes a launch and holds the session', async () => {
    const gone: string[] = []
    const mounted = mount(
      [
        json(200, discovery),
        json(200, statement),
        json(200, { access_token: 'abc', expires_in: 300, token_type: 'Bearer' })
      ],
      gone
    )

    await mounted.connection().connect(base)
    await mounted.connection().signIn('#/type/Patient')

    const state = new URL(gone[0] ?? '').searchParams.get('state') ?? ''
    const back = await mounted.connection().complete({ code: 'code', state })

    expect(back).toBe('#/type/Patient')
    expect(mounted.screen.getByTestId('signed').textContent).toBe('in')
  })

  it('has nothing to finish when no launch was started', async () => {
    const mounted = mount([])

    expect(await mounted.connection().complete({ code: 'code', state: 'x' })).toBeUndefined()
  })

  it('reports an issuer that refused, and returns where it was', async () => {
    const gone: string[] = []
    const mounted = mount([json(200, discovery), json(200, statement), json(400, { error: 'invalid_grant' })], gone)

    await mounted.connection().connect(base)
    await mounted.connection().signIn('#/')
    const state = new URL(gone[0] ?? '').searchParams.get('state') ?? ''

    const back = await mounted.connection().complete({ code: 'code', state })

    expect(back).toBe('#/')
    expect(mounted.screen.getByTestId('trouble').textContent).toContain('invalid_grant')
    expect(mounted.screen.getByTestId('signed').textContent).toBe('out')
  })

  it('forgets a session when it is ended', async () => {
    const gone: string[] = []
    const mounted = mount(
      [json(200, discovery), json(200, statement), json(200, { access_token: 'abc', expires_in: 300 })],
      gone
    )

    await mounted.connection().connect(base)
    await mounted.connection().signIn('#/')
    const state = new URL(gone[0] ?? '').searchParams.get('state') ?? ''
    await mounted.connection().complete({ code: 'code', state })

    mounted.connection().signOut()

    expect(mounted.screen.getByTestId('signed').textContent).toBe('out')
  })

  it('remembers the address it was last pointed at', async () => {
    const mounted = mount([json(200, discovery), json(200, statement)])

    await mounted.connection().connect(base)

    expect(mounted.environment.durable.getItem('fhir-explorer.server')).toBe(base)
  })

  it('refuses to be used without a connection in scope', () => {
    expect(() =>
      render(() => (
        <TroubleProvider>
          <Shown />
        </TroubleProvider>
      ))
    ).toThrow(/connection/)
  })
})

describe('a server asked before there was a session', () => {
  it('is asked again once there is one', async () => {
    const gone: string[] = []
    const mounted = mount(
      [
        json(200, discovery),
        json(401, { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'login' }] }),
        json(200, { access_token: 'abc', expires_in: 300 }),
        json(200, statement)
      ],
      gone
    )

    await mounted.connection().connect(base)
    await waitFor(() => {
      expect(mounted.screen.getByTestId('release').textContent).toBe('')
    })

    await mounted.connection().signIn('#/')
    const state = new URL(gone[0] ?? '').searchParams.get('state') ?? ''
    await mounted.connection().complete({ code: 'code', state })

    await waitFor(() => {
      expect(mounted.screen.getByTestId('release').textContent).toBe('4.0.1')
    })
  })
})

describe('a page a launch is landing on', () => {
  it('asks nothing of the server until the launch has finished', async () => {
    const stub = stubHttp([json(200, { access_token: 'abc', expires_in: 300 }), json(200, statement)])
    const environment = testEnvironment({
      http: stub.http,
      here: () => new URL('https://explorer.example.org/?code=a&state=s')
    })

    environment.durable.setItem('fhir-explorer.server', base)

    render(() => (
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <Shown />
        </ConnectionProvider>
      </TroubleProvider>
    ))

    await waitFor(() => {
      expect(stub.requests).toHaveLength(0)
    })
  })

  it('reconnects to the server it last used when nothing is landing', async () => {
    const stub = stubHttp([json(200, discovery), json(200, statement)])
    const environment = testEnvironment({ http: stub.http })

    environment.durable.setItem('fhir-explorer.server', base)

    const screen = render(() => (
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <Shown />
        </ConnectionProvider>
      </TroubleProvider>
    ))

    await waitFor(() => {
      expect(screen.getByTestId('release').textContent).toBe('4.0.1')
    })
  })
})
