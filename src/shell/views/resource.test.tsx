import { HashRouter, Route } from '@solidjs/router'
import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json, routedHttp } from '../../test/http'
import type { HttpResponse } from '../../domain/transport/port'
import { TroubleProvider } from '../errors'
import { testEnvironment } from '../environment'
import { ConnectionProvider, useConnection } from '../server'
import { TextProvider } from '../text'
import { ResourceView } from './resource'

const discovery = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: [],
  capabilities: []
}

const statement = {
  resourceType: 'CapabilityStatement',
  rest: [{ mode: 'server', resource: [{ type: 'Observation', interaction: [{ code: 'read' }] }] }]
}

const observation = {
  resourceType: 'Observation',
  id: 'o1',
  status: 'final',
  code: { text: 'a measurement' },
  subject: { reference: 'Patient/p1', display: 'Ada Lovelace' },
  valueQuantity: { value: 3, unit: 'kg' }
}

const structure = {
  resourceType: 'StructureDefinition',
  type: 'Observation',
  snapshot: {
    element: [
      { path: 'Observation' },
      { path: 'Observation.status', short: 'the state it is in', min: 1, max: '1' }
    ]
  }
}

function mount(answers: readonly (readonly [string, HttpResponse | Error])[]) {
  const stub = routedHttp([
    ['.well-known/smart-configuration', json(200, discovery)],
    ['/metadata', json(200, statement)],
    ...answers
  ])
  const environment = testEnvironment({ http: stub.http })
  let connection: ReturnType<typeof useConnection> | undefined

  function Reach() {
    connection = useConnection()

    return <ResourceView />
  }

  globalThis.location.hash = '#/type/Observation/o1'

  const screen = render(() => (
    <TextProvider>
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <HashRouter>
            <Route path="/type/:type/:id" component={Reach} />
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

describe('the resource view', () => {
  it('shows what a resource is called and which version it is', async () => {
    const mounted = mount([
      ['/Observation/o1', json(200, observation, { etag: 'W/"4"', 'last-modified': 'Monday' })],
      ['/StructureDefinition', json(404, {})]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByRole('heading', { name: 'a measurement' })).toBeInTheDocument()
    })
    expect(mounted.screen.getByTestId('version').textContent).toBe('Version: 4')
    expect(mounted.screen.getByText(/Last changed: Monday/)).toBeInTheDocument()
  })

  it('labels an element the way the server describes it', async () => {
    const mounted = mount([
      ['/Observation/o1', json(200, observation)],
      ['/StructureDefinition/Observation', json(200, structure)]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByRole('heading', { name: 'a measurement' })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mounted.screen.getByText('the state it is in')).toBeInTheDocument()
    })
  })

  it('says plainly when the server describes nothing', async () => {
    const mounted = mount([
      ['/Observation/o1', json(200, observation)],
      ['/StructureDefinition', json(404, {})]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText(/does not describe this type/)).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('status')).toBeInTheDocument()
  })

  it('shows the raw resource beside the rendered one', async () => {
    const mounted = mount([
      ['/Observation/o1', json(200, observation)],
      ['/StructureDefinition', json(404, {})]
    ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Raw')).toBeInTheDocument()
    })
    mounted.screen.getByText('Raw').click()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('raw').textContent).toContain('"resourceType": "Observation"')
    })
    expect(mounted.screen.getByText('Rendered')).toBeInTheDocument()
  })

  it('makes every reference somewhere to go', async () => {
    const mounted = mount([
      ['/Observation/o1', json(200, observation)],
      ['/StructureDefinition', json(404, {})]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
    })
    const links = mounted.screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links).toContain('#/type/Patient/p1')
    expect(links).toContain('#/graph/Observation/o1')
  })

  it('reports a resource the server would not give', async () => {
    const mounted = mount([
      [
        '/Observation/o1',
        json(404, {
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', diagnostics: 'gone' }]
        })
      ]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.queryByRole('heading')).not.toBeInTheDocument()
    })
  })
})
