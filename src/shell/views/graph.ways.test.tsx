import { Route } from '@solidjs/router'
import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { discovery, renderUnder } from '../../test/view'
import { json, routedHttp } from '@lib/stub'
import { testEnvironment } from '../environment'
import { useConnection } from '../server'
import { GraphView } from './graph'
import { observation, patient, recorder } from '../../test/graph'

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

      return <GraphView painter={painted.fetching} />
    }

    globalThis.location.hash = '#/graph/Patient/p1'

    const screen = renderUnder(environment, () => (
      <>
<Route path="/graph/:type/:id" component={Reach} />
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

  it('asks nothing of its own accord, and offers each way in', async () => {
    const mounted = mountMany()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('1')
    })
    expect(mounted.screen.getByText(/Pointing here/)).toBeInTheDocument()
    expect(mounted.stub.requests.filter((request) => request.url.includes('subject='))).toHaveLength(0)
  })

  it('lists the ways in evenly, whatever the lengths of the names', async () => {
    const mounted = mountMany()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText(/Pointing here/)).toBeInTheDocument()
    })
    expect(mounted.screen.container.querySelector('.types.ways')).toBeInTheDocument()
  })

  it('says how many ways in there are, and offers them rather than looking empty', async () => {
    const mounted = mountMany()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText(/Pointing here/)).toBeInTheDocument()
    })

    const panel = mounted.screen.container.querySelector('details.asking')

    expect(panel?.hasAttribute('open')).toBe(true)
    expect(mounted.screen.getByText(/Pointing here/).textContent).toMatch(/\(\d+\)/)
    expect(mounted.screen.getByText(/Nothing has been asked yet/)).toBeInTheDocument()
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

describe('the ways in, when a server offers many', () => {
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

      return <GraphView painter={painted.fetching} />
    }

    globalThis.location.hash = '#/graph/Patient/p1'

    const screen = renderUnder(environment, () => (
      <>
<Route path="/graph/:type/:id" component={Reach} />
          <Route path="*" component={Reach} />
      </>
    ))

    return {
      screen,
      connect: async () => {
        await connection?.connect('https://example.org/fhir')
      }
    }
  }

  it('can be narrowed to the one a reader is after', async () => {
    const mounted = mountMany()

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Observation')).toBeInTheDocument()
    })

    const filter: HTMLInputElement = mounted.screen.getByLabelText('Filter ways in')
    filter.value = 'obs'
    filter.dispatchEvent(new Event('input', { bubbles: true }))

    await waitFor(() => {
      expect(mounted.screen.queryByText('Claim')).not.toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Observation')).toBeInTheDocument()
  })

  it('says which ways answered and which said nothing', async () => {
    const mounted = mountMany()

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Observation')).toBeInTheDocument()
    })

    mounted.screen.getByText('Observation').click()
    await waitFor(() => {
      expect(mounted.screen.getByText('1 answered')).toBeInTheDocument()
    })

    mounted.screen.getByText('Claim').click()
    await waitFor(() => {
      expect(mounted.screen.getByText('nothing')).toBeInTheDocument()
    })
  })
})
