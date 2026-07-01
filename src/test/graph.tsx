import { Route } from '@solidjs/router'
import { discovery, renderUnder } from './view'
import { json, routedHttp } from '@lib/stub'
import type { HttpResponse } from '@lib/transport'
import type { Graph, NodeKey } from '@lib/graph'
import type { Fetching, Painted, Painter } from '../shell/graph/port'
import { testEnvironment } from '../shell/environment'
import { useConnection } from '../shell/server'
import { GraphView } from '../shell/views/graph'

export const statement = {
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

export const patient = { resourceType: 'Patient', id: 'p1', name: [{ family: 'Lovelace' }] }

export const observation = {
  resourceType: 'Observation',
  id: 'o1',
  code: { text: 'a measurement' },
  subject: { reference: 'Patient/p1' }
}

export function recorder() {
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

  const fetching: Fetching = () => Promise.resolve(painter)

  return {
    fetching,
    shown,
    steered,
    last: () => shown.at(-1),
    choose: (key: NodeKey) => choose?.(key),
    destroyed: () => destroyed
  }
}

export function mount(answers: readonly (readonly [string, HttpResponse | Error])[], given?: Fetching) {
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

    return <GraphView painter={given ?? painted.fetching} />
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
    painted,
    connect: async () => {
      await connection?.connect('https://example.org/fhir')
    }
  }
}
