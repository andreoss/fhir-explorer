import { Route } from '@solidjs/router'
import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { discovery, renderUnder } from '../../test/view'
import { json, stubHttp } from '@lib/stub'
import { testEnvironment } from '../environment'
import { useConnection } from '../server'
import { BrowseView } from './browse'
import { mount, people } from '../../test/browse'

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

    const screen = renderUnder(environment, () => (
      <>
<Route path="/type/:type" component={Reach} />
          <Route path="*" component={Reach} />
      </>
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
