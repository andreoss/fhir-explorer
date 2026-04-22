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
