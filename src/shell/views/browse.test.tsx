import { HashRouter, Route } from '@solidjs/router'
import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json, stubHttp } from '../../test/http'
import type { HttpResponse } from '../../domain/transport/port'
import { TroubleProvider } from '../errors'
import { testEnvironment } from '../environment'
import { ConnectionProvider, useConnection } from '../server'
import { TextProvider } from '../text'
import { BrowseView } from './browse'

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
          type: 'Patient',
          interaction: [{ code: 'read' }, { code: 'search-type' }],
          searchParam: [{ name: 'name', type: 'string' }]
        },
        { type: 'Device', interaction: [{ code: 'read' }] }
      ]
    }
  ]
}

const people = {
  resourceType: 'Bundle',
  type: 'searchset',
  total: 2,
  link: [{ relation: 'next', url: 'https://example.org/fhir/Patient?page=2' }],
  entry: [
    { resource: { resourceType: 'Patient', id: 'p1', name: [{ given: ['Ada'], family: 'Lovelace' }] } },
    { resource: { resourceType: 'Patient', id: 'p2', name: [{ family: 'Hopper' }] } }
  ]
}

function mount(answers: (HttpResponse | Error)[], type = 'Patient') {
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

  const screen = render(() => (
    <TextProvider>
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <HashRouter>
            <Route path="/type/:type" component={Reach} />
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

describe('the browse view', () => {
  it('offers the parameters the server declares, and no others', async () => {
    const mounted = mount([json(200, people)])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByLabelText('name')).toBeInTheDocument()
    })
    expect(mounted.screen.queryByLabelText('birthdate')).not.toBeInTheDocument()
  })

  it('says plainly when a server declares no parameters for a type', async () => {
    const mounted = mount([], 'Device')

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('This server declares no parameters for this type')).toBeInTheDocument()
    })
  })

  it('searches a type the server says it can search, and shows what came back', async () => {
    const mounted = mount([json(200, people)])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Ada Lovelace')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Hopper')).toBeInTheDocument()
    expect(mounted.screen.getByText('Found: 2')).toBeInTheDocument()
  })

  it('does not search a type the server does not offer search on', async () => {
    const mounted = mount([], 'Device')

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('This server declares no parameters for this type')).toBeInTheDocument()
    })
    expect(mounted.stub.requests.filter((request) => request.url.includes('/Device'))).toHaveLength(0)
  })

  it('follows the next page by the link the server gave', async () => {
    const mounted = mount([
      json(200, people),
      json(200, { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Patient', id: 'p3' } }] })
    ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Next page')).toBeInTheDocument()
    })
    mounted.screen.getByText('Next page').click()

    await waitFor(() => {
      expect(mounted.screen.getAllByText('p3').length).toBeGreaterThan(0)
    })
    expect(mounted.stub.requests.at(-1)?.url).toBe('https://example.org/fhir/Patient?page=2')
  })

  it('says nothing was found when nothing was', async () => {
    const mounted = mount([json(200, { resourceType: 'Bundle', total: 0 })])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Nothing was found')).toBeInTheDocument()
    })
  })

  it('reports a search the server refused', async () => {
    const mounted = mount([json(400, { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid', diagnostics: 'bad parameter' }] })])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.queryByText('Found: 2')).not.toBeInTheDocument()
    })
  })
})
