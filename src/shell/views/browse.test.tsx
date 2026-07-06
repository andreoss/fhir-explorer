import { Route } from '@solidjs/router'
import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { discovery, renderUnder } from '../../test/view'
import { json, stubHttp } from '@lib/stub'
import { testEnvironment } from '../environment'
import { useConnection } from '../server'
import { BrowseView } from './browse'
import { mount, people, statement } from '../../test/browse'

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

    const screen = renderUnder(environment, () => (
      <>
<Route path="/type/:type" component={Reach} />
          <Route path="*" component={Reach} />
      </>
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

    const screen = renderUnder(environment, () => (
      <>
<Route path="/type/:type" component={Reach} />
          <Route path="*" component={Reach} />
      </>
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

describe('a list of many, walked page by page', () => {
  const paged = {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 2005,
    link: [{ relation: 'next', url: 'https://example.org/fhir/Patient?page=2' }],
    entry: [{ resource: { resourceType: 'Patient', id: 'p1', name: [{ family: 'Nakamura' }] } }]
  }

  const second = {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 2005,
    link: [
      { relation: 'previous', url: 'https://example.org/fhir/Patient?page=1' },
      { relation: 'next', url: 'https://example.org/fhir/Patient?page=3' }
    ],
    entry: [{ resource: { resourceType: 'Patient', id: 'p2', name: [{ family: 'Silva' }] } }]
  }

  it('says how many were found and which of them is on the screen', async () => {
    const mounted = mount([json(200, paged), json(200, second)])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Found: 2005')).toBeInTheDocument()
    })
    expect(mounted.screen.getByTestId('page').textContent).toContain('1')

    mounted.screen.getByText('Next page').click()

    await waitFor(() => {
      expect(mounted.screen.getByText('Silva')).toBeInTheDocument()
    })
    expect(mounted.screen.getByTestId('page').textContent).toContain('2')
  })

  it('says nothing of pages where there is only one', async () => {
    const mounted = mount([
      json(200, {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [{ resource: { resourceType: 'Patient', id: 'p1', name: [{ family: 'Only' }] } }]
      })
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Only')).toBeInTheDocument()
    })
    expect(mounted.screen.queryByTestId('page')).not.toBeInTheDocument()
  })
})
