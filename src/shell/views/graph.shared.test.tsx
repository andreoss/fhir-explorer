import { Route } from '@solidjs/router'
import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { discovery, renderUnder } from '../../test/view'
import { json, routedHttp } from '@lib/stub'
import { testEnvironment } from '../environment'
import { useConnection } from '../server'
import { GraphView } from './graph'
import { observation, patient, recorder, statement } from '../../test/graph'

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

      return <GraphView painter={painted.fetching} />
    }

    globalThis.location.hash = hash

    const screen = renderUnder(environment, () => (
      <>
<Route path="/graph/:type/:id" component={Reach} />
          <Route path="*" component={Reach} />
      </>
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

      return <GraphView painter={painted.fetching} />
    }

    globalThis.location.hash = hash

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
