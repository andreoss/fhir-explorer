import { Route } from '@solidjs/router'
import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { discovery, renderUnder } from '../../test/view'
import { json } from '@lib/stub'
import { ResourceView } from './resource'
import type { Http } from '@lib/transport'
import { testEnvironment } from '../environment'
import { useConnection } from '../server'
import { EditView } from './edit'
import { mount, observation, statement, structure, type } from '../../test/edit'

describe('the edit view', () => {
  it('builds a field for each element the server describes', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition/Observation', json(200, structure)]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByLabelText('the state it is in')).toBeInTheDocument()
    })
    expect(mounted.screen.getByLabelText('absent')).toHaveAttribute('type', 'checkbox')
    expect(mounted.screen.getByLabelText('valueInteger')).toBeInTheDocument()
    expect(mounted.screen.getByText('Required')).toBeInTheDocument()
  })

  it('falls back to the raw resource where a server describes nothing', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText(/does not describe this type/)).toBeInTheDocument()
    })
    const raw: HTMLTextAreaElement = mounted.screen.getByLabelText('Raw')

    expect(raw.value).toContain('"status": "final"')
  })

  it('refuses to save what a server requires and was left out', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, { resourceType: 'Observation', id: 'o1' })],
        ['/StructureDefinition/Observation', json(200, structure)]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByLabelText('the state it is in')).toBeInTheDocument()
    })

    mounted.screen.getByLabelText('absent').click()
    await waitFor(() => {
      expect(mounted.screen.getByText('Save')).toBeEnabled()
    })
    mounted.screen.getByText('Save').click()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('wrong')).toBeInTheDocument()
    })
    expect(mounted.screen.getAllByText('required').length).toBeGreaterThan(0)
  })

  it('saves what was typed, guarded by the version it read', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation, { etag: 'W/"4"' })],
        ['/StructureDefinition/Observation', json(200, structure)]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByLabelText('the state it is in')).toBeInTheDocument()
    })

    type(mounted.screen.getByLabelText('the state it is in'), 'amended')
    mounted.screen.getByText('Save').click()

    await waitFor(() => {
      expect(mounted.stub.requests.some((request) => request.method === 'PUT')).toBe(true)
    })
    const sent = mounted.stub.requests.find((request) => request.method === 'PUT')
    expect(sent?.headers['if-match']).toBe('W/"4"')
    expect(sent?.body).toContain('amended')
  })

  it('says what the server said against the element it named', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition/Observation', json(200, structure)]
      ],
      '#/type/Observation/o1/edit'
    )

    mounted.stub.requests.length = 0
    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByLabelText('the state it is in')).toBeInTheDocument()
    })

    mounted.screen.getByText('Save').click()

    await waitFor(() => {
      expect(mounted.screen.queryByTestId('wrong')).not.toBeInTheDocument()
    })
  })

  it('marks work that has not been saved', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition/Observation', json(200, structure)]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByLabelText('the state it is in')).toBeInTheDocument()
    })

    type(mounted.screen.getByLabelText('the state it is in'), 'amended')

    await waitFor(() => {
      expect(mounted.screen.getByTestId('unsaved')).toBeInTheDocument()
    })
  })

  it('creates a resource where one was asked for', async () => {
    const mounted = mount(
      [
        ['/StructureDefinition/Observation', json(200, structure)],
        ['/Observation', json(201, { resourceType: 'Observation', id: 'made' }, { location: '/Observation/made' })]
      ],
      '#/type/Observation/new',
      true
    )

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByLabelText('the state it is in')).toBeInTheDocument()
    })

    type(mounted.screen.getByLabelText('the state it is in'), 'final')
    mounted.screen.getByText('Create').click()

    await waitFor(() => {
      expect(mounted.stub.requests.some((request) => request.method === 'POST')).toBe(true)
    })
  })

  it('asks before deleting, and does not when the answer is no', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition/Observation', json(200, structure)]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Delete')).toBeInTheDocument()
    })

    const asked = vi.spyOn(globalThis, 'confirm').mockReturnValue(false)
    mounted.screen.getByText('Delete').click()

    expect(asked).toHaveBeenCalled()
    expect(mounted.stub.requests.some((request) => request.method === 'DELETE')).toBe(false)
    asked.mockRestore()
  })

  it('deletes when the answer is yes', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition/Observation', json(200, structure)]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Delete')).toBeInTheDocument()
    })

    const asked = vi.spyOn(globalThis, 'confirm').mockReturnValue(true)
    mounted.screen.getByText('Delete').click()

    await waitFor(() => {
      expect(mounted.stub.requests.some((request) => request.method === 'DELETE')).toBe(true)
    })
    asked.mockRestore()
  })
})

describe('what is shown after a resource is saved', () => {
  it('shows the version the server answered with, not the one it read', async () => {
    let version = 3
    const requests: { method: string; url: string }[] = []

    const http: Http = (request) => {
      requests.push({ method: request.method, url: request.url })

      if (request.url.includes('smart-configuration')) {
        return Promise.resolve(json(200, discovery))
      }

      if (request.url.endsWith('/metadata')) {
        return Promise.resolve(json(200, statement))
      }

      if (request.url.includes('/StructureDefinition')) {
        return Promise.resolve(json(404, {}))
      }

      if (request.method === 'PUT') {
        version += 1

        return Promise.resolve(
          json(200, { resourceType: 'Observation', id: 'o1', meta: { versionId: String(version) } }, {
            etag: `W/"${String(version)}"`
          })
        )
      }

      return Promise.resolve(
        json(200, { resourceType: 'Observation', id: 'o1', meta: { versionId: String(version) } }, {
          etag: `W/"${String(version)}"`
        })
      )
    }

    const environment = testEnvironment({ http })
    let connection: ReturnType<typeof useConnection> | undefined

    function Reach(props: { readonly making?: boolean }) {
      connection = useConnection()

      return <EditView making={props.making ?? false} />
    }

    globalThis.location.hash = '#/type/Observation/o1/edit'

    const screen = renderUnder(environment, () => (
      <>
<Route path="/type/:type/:id/edit" component={() => <Reach />} />
          <Route path="/type/:type/:id" component={ResourceView} />
          <Route path="*" component={() => <Reach />} />
      </>
    ))

    await connection?.connect('https://example.org/fhir')

    await waitFor(() => {
      expect(screen.getByLabelText('Raw')).toBeInTheDocument()
    })

    const raw: HTMLTextAreaElement = screen.getByLabelText('Raw')
    raw.value = JSON.stringify({ resourceType: 'Observation', id: 'o1', status: 'amended' })
    raw.dispatchEvent(new Event('input', { bubbles: true }))

    screen.getByText('Save').click()

    await waitFor(() => {
      expect(screen.getByTestId('version')).toBeInTheDocument()
    })
    expect(screen.getByTestId('version').textContent).toBe('Version: 4')
  })
})
