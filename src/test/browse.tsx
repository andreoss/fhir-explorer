import { Route } from '@solidjs/router'
import { discovery, renderUnder } from './view'
import { json, stubHttp } from '@lib/stub'
import type { HttpResponse } from '@lib/transport'
import { testEnvironment } from '../shell/environment'
import { useConnection } from '../shell/server'
import { BrowseView } from '../shell/views/browse'

export const statement = {
  resourceType: 'CapabilityStatement',
  rest: [
    {
      mode: 'server',
      resource: [
        {
          type: 'Patient',
          interaction: [{ code: 'read' }, { code: 'search-type' }],
          searchParam: [{ name: 'name', type: 'string' }]
        },
        { type: 'Device', interaction: [{ code: 'read' }] }
      ]
    }
  ]
}

export const people = {
  resourceType: 'Bundle',
  type: 'searchset',
  total: 2,
  link: [{ relation: 'next', url: 'https://example.org/fhir/Patient?page=2' }],
  entry: [
    { resource: { resourceType: 'Patient', id: 'p1', name: [{ given: ['Ada'], family: 'Lovelace' }] } },
    { resource: { resourceType: 'Patient', id: 'p2', name: [{ family: 'Hopper' }] } }
  ]
}

export function mount(answers: (HttpResponse | Error)[], type = 'Patient') {
  const stub = stubHttp([json(200, discovery), json(200, statement), ...answers])
  const environment = testEnvironment({
    http: stub.http,
    here: () => new URL(`http://explorer.example.org/#/type/${type}`)
  })
  let connection: ReturnType<typeof useConnection> | undefined

  function Reach() {
    connection = useConnection()

    return <BrowseView />
  }

  globalThis.location.hash = `#/type/${type}`

  const screen = renderUnder(environment, () => (
      <>
<Route path="/type/:type" component={Reach} />
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
