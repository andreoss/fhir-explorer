import { Route } from '@solidjs/router'
import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { discovery, renderUnder } from '../../test/view'
import { json, routedHttp } from '../../test/http'
import type { HttpResponse } from '../../domain/transport'
import { testEnvironment } from '../environment'
import { useConnection } from '../server'
import { ResourceView } from './resource'

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

  const screen = renderUnder(environment, () => (
      <>
<Route path="/type/:type/:id" component={Reach} />
        <Route path="*" component={Reach} />
      </>
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
    expect(mounted.screen.getAllByText('Status').length).toBeGreaterThan(0)
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

describe('a resource read at a glance', () => {
  it('says its facts before its structure', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('facts')).toBeInTheDocument()
    })
    const facts = mounted.screen.getByTestId('facts')
    expect(facts.textContent).toContain('a measurement')
    expect(facts.textContent).toContain('final')
  })

  it('takes the raw form in one action', async () => {
    const written: string[] = []

    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (said: string) => {
          written.push(said)

          return Promise.resolve()
        }
      }
    })

    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Raw')).toBeInTheDocument()
    })
    mounted.screen.getByText('Raw').click()
    await waitFor(() => {
      expect(mounted.screen.getByText('Copy')).toBeInTheDocument()
    })

    mounted.screen.getByText('Copy').click()

    await waitFor(() => {
      expect(written[0]).toContain('"resourceType": "Observation"')
    })
    expect(await mounted.screen.findByText('Copied')).toBeInTheDocument()
  })
})

describe('a value said as a reader would say it', () => {
  it('shows a measurement with its number, and a day as a day', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, {
          resourceType: 'Observation',
          id: 'o1',
          effectiveDateTime: '2026-01-12T09:10:00Z',
          valueQuantity: { value: 70.5, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' }
        })],
        ['/StructureDefinition', json(404, {})]
      ]
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getAllByText('70.5 kg').length).toBeGreaterThan(0)
    })
    expect(mounted.screen.queryByText('kg')).not.toBeInTheDocument()
    expect(mounted.screen.getAllByText('Jan 12, 2026, 9:10 AM').length).toBeGreaterThan(0)
    expect(mounted.screen.queryByText('2026-01-12T09:10:00Z')).not.toBeInTheDocument()
  })
})

describe('actions that sit together', () => {
  it('draws each of them alike', async () => {
    const mounted = mount([
      ['/Observation/o1', json(200, observation)],
      ['/StructureDefinition', json(404, {})]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Raw')).toBeInTheDocument()
    })

    const named = ['Open in the graph', 'History', 'Edit', 'Raw']
    const drawn = named.map((name) => {
      const found =
        mounted.screen.queryByRole('link', { name }) ?? mounted.screen.getByRole('button', { name })

      return found.classList.contains('action')
    })

    expect(drawn).toEqual([true, true, true, true])
  })
})

