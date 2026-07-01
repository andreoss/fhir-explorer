import { Route } from '@solidjs/router'
import { discovery, renderUnder } from './view'
import { json, routedHttp } from '@lib/stub'
import type { HttpResponse } from '@lib/transport'
import { testEnvironment } from '../shell/environment'
import { useConnection } from '../shell/server'
import { EditView } from '../shell/views/edit'

export const statement = {
  resourceType: 'CapabilityStatement',
  rest: [{ mode: 'server', resource: [{ type: 'Observation', interaction: [{ code: 'read' }] }] }]
}

export const structure = {
  resourceType: 'StructureDefinition',
  type: 'Observation',
  snapshot: {
    element: [
      { path: 'Observation' },
      { path: 'Observation.status', min: 1, max: '1', type: [{ code: 'code' }], short: 'the state it is in' },
      { path: 'Observation.absent', min: 0, max: '1', type: [{ code: 'boolean' }] },
      { path: 'Observation.valueInteger', min: 0, max: '1', type: [{ code: 'integer' }] }
    ]
  }
}

export const observation = { resourceType: 'Observation', id: 'o1', status: 'final' }

export function mount(
  answers: readonly (readonly [string, HttpResponse | Error])[],
  hash: string,
  making = false
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

    return <EditView making={making} />
  }

  globalThis.location.hash = hash

  const screen = renderUnder(environment, () => (
      <>
<Route path="/type/:type/new" component={Reach} />
        <Route path="/type/:type/:id/edit" component={Reach} />
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

export function type(field: HTMLElement, value: string) {
  const input: HTMLInputElement = field as HTMLInputElement

  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
