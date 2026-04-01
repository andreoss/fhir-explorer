import { HashRouter, Route } from '@solidjs/router'
import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json, routedHttp } from '../../test/http'
import type { HttpResponse } from '../../domain/transport/port'
import type { Graph, NodeKey } from '../../domain/graph/model'
import type { Painted, Painter } from '../graph/port'
import { TroubleProvider } from '../errors'
import { testEnvironment } from '../environment'
import { ConnectionProvider, useConnection } from '../server'
import { TextProvider } from '../text'
import { GraphView } from './graph'

const discovery = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: [],
  capabilities: []
}

const statement = {
  resourceType: 'CapabilityStatement',
  rest: [
    {
      mode: 'server',
      resource: [
        {
          type: 'Observation',
          interaction: [{ code: 'read' }, { code: 'search-type' }],
          searchParam: [{ name: 'subject', type: 'reference' }]
        },
        { type: 'Patient', interaction: [{ code: 'read' }] }
      ]
    }
  ]
}

const patient = { resourceType: 'Patient', id: 'p1', name: [{ family: 'Lovelace' }] }

const observation = {
  resourceType: 'Observation',
  id: 'o1',
  code: { text: 'a measurement' },
  subject: { reference: 'Patient/p1' }
}

function recorder() {
  const shown: { graph: Graph; focus: NodeKey }[] = []
  const steered: string[] = []
  let destroyed = false
  let choose: ((key: NodeKey) => void) | undefined

  const painter: Painter = (): Painted => ({
    show: (graph, focus) => {
      shown.push({ graph, focus })
    },
    onChoose: (taken) => {
      choose = taken
    },
    fit: () => steered.push('fit'),
    zoom: (by) => steered.push(`zoom ${String(by)}`),
    destroy: () => {
      destroyed = true
    }
  })

  return {
    painter,
    shown,
    steered,
    last: () => shown.at(-1),
    choose: (key: NodeKey) => choose?.(key),
    destroyed: () => destroyed
  }
}

function mount(answers: readonly (readonly [string, HttpResponse | Error])[]) {
  const painted = recorder()
  const stub = routedHttp([
    ['.well-known/smart-configuration', json(200, discovery)],
    ['/metadata', json(200, statement)],
    ...answers
  ])
  const environment = testEnvironment({ http: stub.http })
  let connection: ReturnType<typeof useConnection> | undefined

  function Reach() {
    connection = useConnection()

    return <GraphView painter={painted.painter} />
  }

  globalThis.location.hash = '#/graph/Patient/p1'

  const screen = render(() => (
    <TextProvider>
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <HashRouter>
            <Route path="/graph/:type/:id" component={Reach} />
            <Route path="*" component={Reach} />
          </HashRouter>
        </ConnectionProvider>
      </TroubleProvider>
    </TextProvider>
  ))

  return {
    screen,
    stub,
    painted,
    connect: async () => {
      await connection?.connect('https://example.org/fhir')
    }
  }
}

describe('the graph view', () => {
  it('starts from the resource it was opened on', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('1')
    })
    expect(mounted.screen.getByTestId('focus').textContent).toBe('Patient/p1')
  })

  it('draws what points at the resource, asked through declared parameters', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('2')
    })
    expect(mounted.painted.last()?.graph.edges).toEqual([
      { from: 'Observation/o1', to: 'Patient/p1', path: 'subject' }
    ])
    expect(mounted.stub.requests.some((request) => request.url.includes('subject=Patient%2Fp1'))).toBe(true)
  })

  it('grows when a node is chosen in the drawing', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation/o1', json(200, observation)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('2')
    })

    mounted.painted.choose('Observation/o1')

    await waitFor(() => {
      expect(mounted.screen.getByTestId('focus').textContent).toBe('Observation/o1')
    })
  })

  it('lists what touches the node in focus and expands it when asked', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation/o1', json(200, observation)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText(/Observation: a measurement/)).toBeInTheDocument()
    })

    mounted.screen.getByText('Expand').click()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('focus').textContent).toBe('Observation/o1')
    })
  })

  it('reports a resource the server would not give, and keeps the rest', async () => {
    const mounted = mount([
      ['/Patient/p1', json(404, { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] })],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('This resource points nowhere')).toBeInTheDocument()
    })
  })

  it('hands the drawing to whatever was given to draw it', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.painted.shown.length).toBeGreaterThan(0)
    })
    expect(mounted.painted.last()?.focus).toBe('Patient/p1')
  })
})

describe('the graph view on a server that declares many ways in', () => {
  const many = {
    resourceType: 'CapabilityStatement',
    rest: [
      {
        mode: 'server',
        resource: [
          { type: 'Patient', interaction: [{ code: 'read' }] },
          ...['Account', 'Appointment', 'Claim', 'Observation'].map((type) => ({
            type,
            interaction: [{ code: 'read' }, { code: 'search-type' }],
            searchParam: [{ name: 'subject', type: 'reference' }]
          }))
        ]
      }
    ]
  }

  function mountMany() {
    const painted = recorder()
    const stub = routedHttp([
      ['.well-known/smart-configuration', json(200, discovery)],
      ['/metadata', json(200, many)],
      ['/Patient/p1', json(200, patient)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })],
      ['?subject=', json(200, { resourceType: 'Bundle' })]
    ])
    const environment = testEnvironment({ http: stub.http })
    let connection: ReturnType<typeof useConnection> | undefined

    function Reach() {
      connection = useConnection()

      return <GraphView painter={painted.painter} />
    }

    globalThis.location.hash = '#/graph/Patient/p1'

    const screen = render(() => (
      <TextProvider>
        <TroubleProvider>
          <ConnectionProvider environment={environment}>
            <HashRouter>
              <Route path="/graph/:type/:id" component={Reach} />
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

  it('asks nothing of its own accord, and offers each way in', async () => {
    const mounted = mountMany()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('1')
    })
    expect(mounted.screen.getByText('Pointing here')).toBeInTheDocument()
    expect(mounted.stub.requests.filter((request) => request.url.includes('subject='))).toHaveLength(0)
  })

  it('asks the one a reader chose', async () => {
    const mounted = mountMany()

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Observation')).toBeInTheDocument()
    })

    mounted.screen.getByText('Observation').click()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('2')
    })
  })
})

describe('an exploration that can be shared', () => {
  function mountAt(hash: string) {
    const painted = recorder()
    const stub = routedHttp([
      ['.well-known/smart-configuration', json(200, discovery)],
      ['/metadata', json(200, statement)],
      ['/Patient/p1', json(200, patient)],
      ['/Observation/o1', json(200, observation)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])
    const environment = testEnvironment({ http: stub.http })
    let connection: ReturnType<typeof useConnection> | undefined

    function Reach() {
      connection = useConnection()

      return <GraphView painter={painted.painter} />
    }

    globalThis.location.hash = hash

    const screen = render(() => (
      <TextProvider>
        <TroubleProvider>
          <ConnectionProvider environment={environment}>
            <HashRouter>
              <Route path="/graph/:type/:id" component={Reach} />
              <Route path="*" component={Reach} />
            </HashRouter>
          </ConnectionProvider>
        </TroubleProvider>
      </TextProvider>
    ))

    return {
      screen,
      painted,
      connect: async () => {
        await connection?.connect('https://example.org/fhir')
      }
    }
  }

  it('writes what it has opened into the address', async () => {
    const mounted = mountAt('#/graph/Patient/p1')

    await mounted.connect()

    await waitFor(() => {
      expect(globalThis.location.hash).toContain('seen=Patient%2Fp1')
    })
    expect(globalThis.location.hash).toContain('focus=Patient%2Fp1')
  })

  it('opens again what a shared address carries', async () => {
    const mounted = mountAt('#/graph/Patient/p1?seen=Patient%2Fp1,Observation%2Fo1&focus=Observation%2Fo1')

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('2')
    })
    expect(mounted.screen.getByTestId('focus').textContent).toBe('Observation/o1')
  })
})

describe('an exploration that remembers what it asked', () => {
  const many = {
    resourceType: 'CapabilityStatement',
    rest: [
      {
        mode: 'server',
        resource: [
          { type: 'Patient', interaction: [{ code: 'read' }] },
          ...['Account', 'Appointment', 'Claim', 'Observation'].map((type) => ({
            type,
            interaction: [{ code: 'read' }, { code: 'search-type' }],
            searchParam: [{ name: 'subject', type: 'reference' }]
          }))
        ]
      }
    ]
  }

  function mountAt(hash: string) {
    const painted = recorder()
    const stub = routedHttp([
      ['.well-known/smart-configuration', json(200, discovery)],
      ['/metadata', json(200, many)],
      ['/Patient/p1', json(200, patient)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })],
      ['?subject=', json(200, { resourceType: 'Bundle' })]
    ])
    const environment = testEnvironment({ http: stub.http })
    let connection: ReturnType<typeof useConnection> | undefined

    function Reach() {
      connection = useConnection()

      return <GraphView painter={painted.painter} />
    }

    globalThis.location.hash = hash

    const screen = render(() => (
      <TextProvider>
        <TroubleProvider>
          <ConnectionProvider environment={environment}>
            <HashRouter>
              <Route path="/graph/:type/:id" component={Reach} />
              <Route path="*" component={Reach} />
            </HashRouter>
          </ConnectionProvider>
        </TroubleProvider>
      </TextProvider>
    ))

    return {
      screen,
      connect: async () => {
        await connection?.connect('https://example.org/fhir')
      }
    }
  }

  it('writes the way in it was asked about into the address', async () => {
    const mounted = mountAt('#/graph/Patient/p1')

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Observation')).toBeInTheDocument()
    })

    mounted.screen.getByText('Observation').click()

    await waitFor(() => {
      expect(globalThis.location.hash).toContain('asked=Patient%2Fp1%7CObservation')
    })
  })

  it('asks it again when the address is opened elsewhere', async () => {
    const mounted = mountAt('#/graph/Patient/p1?seen=Patient%2Fp1&asked=Patient%2Fp1%7CObservation')

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('2')
    })
  })
})
