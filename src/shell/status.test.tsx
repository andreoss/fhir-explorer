import { render, waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { discovery } from '../test/view'
import { json, stubHttp } from '@lib/stub'
import type { HttpResponse } from '@lib/transport'
import { TroubleProvider } from './errors'
import { testEnvironment } from './environment'
import { ConnectionProvider, useConnection } from './server'
import { Status } from './status'
import { TextProvider } from './text'

function mount(answers: (HttpResponse | Error)[] = []) {
  const stub = stubHttp(answers)
  const environment = testEnvironment({ http: stub.http })
  let connection: ReturnType<typeof useConnection> | undefined

  function Reach() {
    connection = useConnection()

    return <Status />
  }

  const screen = render(() => (
    <TextProvider>
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <Reach />
        </ConnectionProvider>
      </TroubleProvider>
    </TextProvider>
  ))

  return {
    screen,
    connect: async (address: string) => {
      await connection?.connect(address)
    }
  }
}

describe('the status', () => {
  it('says nothing is held before a server is chosen', () => {
    const mounted = mount()

    expect(mounted.screen.getByTestId('session').textContent).toBe('No session')
  })

  it('reports the server, not its own handle', async () => {
    const mounted = mount([
      json(200, discovery),
      json(200, { resourceType: 'CapabilityStatement', fhirVersion: '5.0.0', software: { name: 'a server', version: '2' } })
    ])

    await mounted.connect('https://example.org/fhir')

    await waitFor(() => {
      expect(mounted.screen.getByTestId('standing').textContent).toBe('Answering')
    })
    expect(mounted.screen.getByText(/Release: 5.0.0/)).toBeInTheDocument()
    expect(mounted.screen.getByText(/Software: a server 2/)).toBeInTheDocument()
  })

  it('says a server did not answer when it did not', async () => {
    const mounted = mount([new Error('down')])

    await mounted.connect('https://example.org/fhir')

    expect(mounted.screen.getByTestId('standing').textContent).toBe('This server did not answer')
  })

  it('says a server cannot be explored when it advertises nothing', async () => {
    const mounted = mount([json(404, {})])

    await mounted.connect('https://example.org/fhir')

    expect(mounted.screen.getByTestId('standing').textContent).toBe('This server cannot be explored')
  })
})
