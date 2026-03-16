import { HashRouter, Route } from '@solidjs/router'
import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json, routedHttp } from '../../test/http'
import type { HttpResponse } from '../../domain/transport/port'
import { TroubleProvider } from '../errors'
import { testEnvironment } from '../environment'
import { ConnectionProvider, useConnection } from '../server'
import { TextProvider } from '../text'
import { HistoryView } from './history'
import { VersionView } from './version'

const discovery = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: [],
  capabilities: []
}

const statement = { resourceType: 'CapabilityStatement' }

const history = {
  resourceType: 'Bundle',
  type: 'history',
  entry: [
    { resource: { resourceType: 'Patient', id: 'p1', meta: { versionId: '2', lastUpdated: 'Tuesday' } } },
    { resource: { resourceType: 'Patient', id: 'p1', meta: { versionId: '1', lastUpdated: 'Monday' } } }
  ]
}

function mount(
  answers: readonly (readonly [string, HttpResponse | Error])[],
  hash: string,
  which: 'history' | 'version'
) {
  const stub = routedHttp([
    ['.well-known/smart-configuration', json(200, discovery)],
    ['/metadata', json(200, statement)],
    ...answers
  ])
  const environment = testEnvironment({ http: stub.http })
  let connection: ReturnType<typeof useConnection> | undefined

  function Reach() {
    connection = useConnection()

    return <>{which === 'history' ? <HistoryView /> : <VersionView />}</>
  }

  globalThis.location.hash = hash

  const screen = render(() => (
    <TextProvider>
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <HashRouter>
            <Route path="/type/:type/:id/history" component={Reach} />
            <Route path="/type/:type/:id/version/:version" component={Reach} />
            <Route path="*" component={Reach} />
          </HashRouter>
        </ConnectionProvider>
      </TroubleProvider>
    </TextProvider>
  ))

  return {
    screen,
    stub,
    connect: async () => {
      await connection?.connect('https://example.org/fhir')
    }
  }
}

describe('the history of a resource', () => {
  it('lists every version the server kept, newest first', async () => {
    const mounted = mount([['/Patient/p1/_history', json(200, history)]], '#/type/Patient/p1/history', 'history')

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Tuesday')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Monday')).toBeInTheDocument()
    expect(mounted.screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toContain(
      '#/type/Patient/p1/version/2'
    )
  })

  it('reports a history the server would not give', async () => {
    const mounted = mount(
      [['/Patient/p1/_history', json(403, { resourceType: 'OperationOutcome' })]],
      '#/type/Patient/p1/history',
      'history'
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Nothing was found')).toBeInTheDocument()
    })
  })

  it('shows one version as the server kept it', async () => {
    const mounted = mount(
      [
        [
          '/Patient/p1/_history/1',
          json(200, { resourceType: 'Patient', id: 'p1', meta: { versionId: '1' }, name: [{ family: 'Before' }] })
        ]
      ],
      '#/type/Patient/p1/version/1',
      'version'
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('raw').textContent).toContain('Before')
    })
    expect(mounted.screen.getByRole('heading', { name: 'Version 1' })).toBeInTheDocument()
  })

  it('reports a version the server does not have', async () => {
    const mounted = mount(
      [['/Patient/p1/_history/9', json(404, { resourceType: 'OperationOutcome' })]],
      '#/type/Patient/p1/version/9',
      'version'
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.queryByTestId('raw')).not.toBeInTheDocument()
    })
  })
})
