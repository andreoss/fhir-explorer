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
      expect(mounted.screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
    })
    expect(mounted.screen.getAllByText('Hopper').length).toBeGreaterThan(0)
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
      expect(mounted.screen.getAllByText('Patient/p3').length).toBeGreaterThan(0)
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

describe('a search that can be shared', () => {
  it('runs what the address carries when it is opened', async () => {
    const stub = stubHttp([
      json(200, discovery),
      json(200, statement),
      json(200, { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Patient', id: 'p9' } }] })
    ])
    const environment = testEnvironment({ http: stub.http })
    let connection: ReturnType<typeof useConnection> | undefined

    function Reach() {
      connection = useConnection()

      return <BrowseView />
    }

    globalThis.location.hash = '#/type/Patient?name=Ada'

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

    await connection?.connect('https://example.org/fhir')

    await waitFor(() => {
      expect(screen.getAllByText('Patient/p9').length).toBeGreaterThan(0)
    })
    expect(stub.requests.at(-1)?.url).toContain('name=Ada')
  })

  it('offers full text only where the server declares it', async () => {
    const mounted = mount([json(200, { resourceType: 'Bundle' })])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByLabelText('name')).toBeInTheDocument()
    })
    expect(mounted.screen.queryByLabelText('_text')).not.toBeInTheDocument()
  })

  it('offers full text where the server does declare it', async () => {
    const stub = stubHttp([
      json(200, discovery),
      json(200, {
        resourceType: 'CapabilityStatement',
        rest: [
          {
            mode: 'server',
            resource: [
              {
                type: 'Patient',
                interaction: [{ code: 'search-type' }],
                searchParam: [{ name: '_text', type: 'string' }]
              }
            ]
          }
        ]
      }),
      json(200, { resourceType: 'Bundle' })
    ])
    const environment = testEnvironment({ http: stub.http })
    let connection: ReturnType<typeof useConnection> | undefined

    function Reach() {
      connection = useConnection()

      return <BrowseView />
    }

    globalThis.location.hash = '#/type/Patient'

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

    await connection?.connect('https://example.org/fhir')

    await waitFor(() => {
      expect(screen.getByLabelText('_text')).toBeInTheDocument()
    })
  })
})

describe('what a search is asking', () => {
  it('shows each part of what it asked', async () => {
    const mounted = mount([json(200, { resourceType: 'Bundle' })], 'Patient?name=Ada')

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('asked')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('name=Ada')).toBeInTheDocument()
  })

  it('lets a reader take one part back off', async () => {
    const mounted = mount([json(200, { resourceType: 'Bundle' }), json(200, { resourceType: 'Bundle' })], 'Patient?name=Ada')

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByTestId('asked')).toBeInTheDocument()
    })

    mounted.screen.getByLabelText('Clear name').click()

    await waitFor(() => {
      expect(mounted.screen.queryByTestId('asked')).not.toBeInTheDocument()
    })
  })

  it('shows nothing where nothing was asked', async () => {
    const mounted = mount([json(200, { resourceType: 'Bundle' })])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByLabelText('name')).toBeInTheDocument()
    })
    expect(mounted.screen.queryByTestId('asked')).not.toBeInTheDocument()
  })
})

describe('a result worth reading', () => {
  it('shows what most of the results carry, as columns', async () => {
    const mounted = mount([
      json(200, {
        resourceType: 'Bundle',
        entry: [
          { resource: { resourceType: 'Patient', id: 'p1', name: [{ family: 'Lovelace' }], gender: 'female' } },
          { resource: { resourceType: 'Patient', id: 'p2', name: [{ family: 'Hopper' }], gender: 'female' } }
        ]
      })
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByRole('columnheader', { name: 'Gender' })).toBeInTheDocument()
    })
    expect(mounted.screen.getAllByText('female')).toHaveLength(2)
  })

  it('still names the type, and gives identity to what has no name of its own', async () => {
    const mounted = mount([
      json(200, {
        resourceType: 'Bundle',
        entry: [
          { resource: { resourceType: 'Patient', id: 'p1', name: [{ family: 'Lovelace' }] } },
          { resource: { resourceType: 'Patient', id: 'p2' } }
        ]
      })
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByRole('columnheader', { name: 'Patient' })).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Lovelace')).toBeInTheDocument()
    expect(mounted.screen.getByText('Patient/p2')).toBeInTheDocument()
  })
})

describe('a search form a reader can take in at a glance', () => {
  const many = {
    resourceType: 'CapabilityStatement',
    rest: [
      {
        mode: 'server',
        resource: [
          {
            type: 'Patient',
            interaction: [{ code: 'search-type' }],
            searchParam: [
              ...['_id', '_lastUpdated', '_profile', '_tag'].map((name) => ({ name, type: 'token' })),
              ...['active', 'address', 'birthdate', 'family', 'gender', 'given', 'identifier', 'name'].map(
                (name) => ({ name, type: 'string' })
              )
            ]
          }
        ]
      }
    ]
  }

  it('offers the parameters a reader reaches for, and folds the rest away', async () => {
    const stub = stubHttp([json(200, discovery), json(200, many), json(200, { resourceType: 'Bundle' })])
    const environment = testEnvironment({ http: stub.http })
    let connection: ReturnType<typeof useConnection> | undefined

    function Reach() {
      connection = useConnection()

      return <BrowseView />
    }

    globalThis.location.hash = '#/type/Patient'

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

    await connection?.connect('https://example.org/fhir')

    await waitFor(() => {
      expect(screen.getByLabelText('active')).toBeInTheDocument()
    })
    expect(screen.getByText(/More parameters/)).toBeInTheDocument()
    expect(screen.getByText(/\(6\)/)).toBeInTheDocument()
  })
})

describe('a result a reader can read', () => {
  const flagged = {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 2,
    entry: [
      { resource: { resourceType: 'Patient', id: 'p1', active: true, name: [{ family: 'Lovelace' }] } },
      { resource: { resourceType: 'Patient', id: 'p2', active: false, name: [{ family: 'Hopper' }] } }
    ]
  }

  it('says a flag as a reader would say it rather than as the wire spells it', async () => {
    const mounted = mount([json(200, flagged)])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Lovelace')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Yes')).toBeInTheDocument()
    expect(mounted.screen.getByText('No')).toBeInTheDocument()
    expect(mounted.screen.queryByText('true')).not.toBeInTheDocument()
  })

  it('says what is arriving in a row the page already has', async () => {
    const mounted = mount([json(200, flagged)])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Lovelace')).toBeInTheDocument()
    })
    expect(mounted.screen.container.querySelector('.heading [data-testid="busy"]')).toBeInTheDocument()
  })
})

describe('a result that carries what a reader came for', () => {
  const nameless = {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 1,
    entry: [{ resource: { resourceType: 'Patient', id: '0f386f7e-b484-4b7e-8b8b-3ff76e15714e' } }]
  }

  it('gives no column to identifiers, and names what has no name by a short identity', async () => {
    const mounted = mount([json(200, nameless)])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Patient/0f386f7e…')).toBeInTheDocument()
    })
    expect(mounted.screen.queryByRole('columnheader', { name: 'id' })).not.toBeInTheDocument()
    expect(mounted.screen.queryByText('0f386f7e-b484-4b7e-8b8b-3ff76e15714e')).not.toBeInTheDocument()
  })

  it('says what a field is while it holds a value, not only while it is empty', async () => {
    const mounted = mount([json(200, people)])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Ada Lovelace')).toBeInTheDocument()
    })
    expect(mounted.screen.container.querySelector('.field-name')?.textContent).toBe('name')
    expect(mounted.screen.getByLabelText('name')).toBeInTheDocument()
  })
})

describe('a field that says what it wants', () => {
  it('says the kind the server declared for it, and still takes anything', async () => {
    const mounted = mount([json(200, people)])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByLabelText('name')).toBeInTheDocument()
    })
    expect(mounted.screen.container.querySelector('.kind')?.textContent).toBe('string')

    const field: HTMLInputElement = mounted.screen.getByLabelText('name')

    expect(field.getAttribute('type')).toBeNull()
  })
})

