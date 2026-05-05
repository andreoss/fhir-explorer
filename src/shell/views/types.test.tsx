import { HashRouter, Route } from '@solidjs/router'
import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json, stubHttp } from '../../test/http'
import { TroubleProvider } from '../errors'
import { testEnvironment } from '../environment'
import { ConnectionProvider, useConnection } from '../server'
import { TextProvider } from '../text'
import { TypesView } from './types'

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
        { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }] },
        { type: 'Observation', interaction: [{ code: 'read' }] }
      ]
    }
  ]
}

function mount() {
  const stub = stubHttp([json(200, discovery), json(200, statement)])
  const environment = testEnvironment({ http: stub.http })
  let connection: ReturnType<typeof useConnection> | undefined

  function Reach() {
    connection = useConnection()

    return <TypesView />
  }

  const screen = render(() => (
    <TextProvider>
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <HashRouter>
            <Route path="*" component={Reach} />
          </HashRouter>
        </ConnectionProvider>
      </TroubleProvider>
    </TextProvider>
  ))

  return {
    screen,
    connect: async () => {
      await connection?.connect('https://example.org/fhir')
    }
  }
}

describe('the types view', () => {
  it('says a server declares nothing until one does', () => {
    const mounted = mount()

    expect(mounted.screen.getByText('This server declares no types')).toBeInTheDocument()
  })

  it('lists what the statement declares, and nothing else', async () => {
    const mounted = mount()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Patient')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Observation')).toBeInTheDocument()
    expect(mounted.screen.queryByText('Encounter')).not.toBeInTheDocument()
  })

  it('says what can be done with each type', async () => {
    const mounted = mount()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('searchable')).toBeInTheDocument()
    })
  })

  it('filters to what a reader is looking for', async () => {
    const mounted = mount()

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Patient')).toBeInTheDocument()
    })

    const filter: HTMLInputElement = mounted.screen.getByLabelText('Filter types')
    filter.value = 'obs'
    filter.dispatchEvent(new Event('input', { bubbles: true }))

    await waitFor(() => {
      expect(mounted.screen.queryByText('Patient')).not.toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Observation')).toBeInTheDocument()
  })
})

describe('what can be done with a type', () => {
  it('marks the ones that can be searched and the ones that can be written', async () => {
    const mounted = mount()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Patient')).toBeInTheDocument()
    })
    expect(mounted.screen.getAllByText('searchable')).toHaveLength(1)
    expect(mounted.screen.queryByText('writable')).not.toBeInTheDocument()
  })

  it('says how many are shown, and keeps the filter in reach', async () => {
    const mounted = mount()

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByTestId('counted').textContent).toBe('2 types')
    })

    const filter: HTMLInputElement = mounted.screen.getByLabelText('Filter types')
    filter.value = 'pat'
    filter.dispatchEvent(new Event('input', { bubbles: true }))

    await waitFor(() => {
      expect(mounted.screen.getByTestId('counted').textContent).toBe('1 types')
    })
  })
})

describe('a list a reader can walk', () => {
  const many = {
    resourceType: 'CapabilityStatement',
    rest: [
      {
        mode: 'server',
        resource: [
          { type: 'Account', interaction: [{ code: 'search-type' }] },
          { type: 'Binary', interaction: [{ code: 'read' }] },
          { type: 'Patient', interaction: [{ code: 'search-type' }, { code: 'update' }] }
        ]
      }
    ]
  }

  function mountMany(recent: readonly string[] = []) {
    const stub = stubHttp([json(200, discovery), json(200, many)])
    const environment = testEnvironment({ http: stub.http })

    if (recent.length > 0) {
      environment.durable.setItem('fhir-explorer.types', JSON.stringify(recent))
    }
    let connection: ReturnType<typeof useConnection> | undefined

    function Reach() {
      connection = useConnection()

      return <TypesView />
    }

    const screen = render(() => (
      <TextProvider>
        <TroubleProvider>
          <ConnectionProvider environment={environment}>
            <HashRouter>
              <Route path="*" component={Reach} />
            </HashRouter>
          </ConnectionProvider>
        </TroubleProvider>
      </TextProvider>
    ))

    return {
      screen,
      environment,
      connect: async () => {
        await connection?.connect('https://example.org/fhir')
      }
    }
  }

  it('gathers the types under the letter they start with', async () => {
    const mounted = mountMany()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByRole('region', { name: 'A' })).toBeInTheDocument()
    })
    expect(mounted.screen.getByRole('region', { name: 'P' })).toBeInTheDocument()
  })

  it('offers the letters as a way in', async () => {
    const mounted = mountMany()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByRole('link', { name: 'B' })).toBeInTheDocument()
    })

    mounted.screen.getByRole('link', { name: 'B' }).click()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('counted').textContent).toBe('1 types')
    })
  })

  it('marks only what sets a type apart', async () => {
    const mounted = mountMany()

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Patient')).toBeInTheDocument()
    })
    expect(mounted.screen.getAllByText('searchable')).toHaveLength(2)
    expect(mounted.screen.getAllByText('writable')).toHaveLength(1)
  })

  it('offers the types opened before, once there are any', async () => {
    const mounted = mountMany(['Patient'])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('recent')).toBeInTheDocument()
    })
  })
})
