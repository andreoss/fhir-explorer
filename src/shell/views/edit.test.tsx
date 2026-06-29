import { Route } from '@solidjs/router'
import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { discovery, renderUnder } from '../../test/view'
import { json, routedHttp } from '@lib/stub'
import type { Http, HttpResponse } from '@lib/transport'
import { ResourceView } from './resource'
import { testEnvironment } from '../environment'
import { useConnection } from '../server'
import { EditView } from './edit'

const statement = {
  resourceType: 'CapabilityStatement',
  rest: [{ mode: 'server', resource: [{ type: 'Observation', interaction: [{ code: 'read' }] }] }]
}

const structure = {
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

const observation = { resourceType: 'Observation', id: 'o1', status: 'final' }

function mount(
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

function type(field: HTMLElement, value: string) {
  const input: HTMLInputElement = field as HTMLInputElement

  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

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

describe('a form with elements that repeat and nest', () => {
  const nested = {
    resourceType: 'StructureDefinition',
    type: 'Patient',
    snapshot: {
      element: [
        { path: 'Patient' },
        { path: 'Patient.active', min: 0, max: '1', type: [{ code: 'boolean' }] },
        { path: 'Patient.contact', min: 0, max: '*', type: [{ code: 'BackboneElement' }] },
        { path: 'Patient.contact.gender', min: 0, max: '1', type: [{ code: 'code' }] },
        { path: 'Patient.contact.rank', min: 0, max: '1', type: [{ code: 'integer' }] }
      ]
    }
  }

  function mountPatient(resource: Record<string, unknown>) {
    return mount(
      [
        ['/Patient/p1', json(200, resource)],
        ['/StructureDefinition/Patient', json(200, nested)]
      ],
      '#/type/Patient/p1/edit'
    )
  }

  it('shows a field for each element of each repeat', async () => {
    const mounted = mountPatient({
      resourceType: 'Patient',
      id: 'p1',
      contact: [{ gender: 'female', rank: 1 }, { gender: 'male' }]
    })

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByLabelText('gender 1')).toBeInTheDocument()
    })
    const first: HTMLInputElement = mounted.screen.getByLabelText('gender 1')
    const second: HTMLInputElement = mounted.screen.getByLabelText('gender 2')
    const rank: HTMLInputElement = mounted.screen.getByLabelText('rank 1')

    expect(first.value).toBe('female')
    expect(second.value).toBe('male')
    expect(rank.value).toBe('1')
  })

  it('adds one more where a server allows many', async () => {
    const mounted = mountPatient({ resourceType: 'Patient', id: 'p1' })

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText(/Add contact/)).toBeInTheDocument()
    })

    mounted.screen.getByText(/Add contact/).click()

    await waitFor(() => {
      expect(mounted.screen.getByLabelText('gender 1')).toBeInTheDocument()
    })
  })

  it('takes one away again', async () => {
    const mounted = mountPatient({ resourceType: 'Patient', id: 'p1', contact: [{ gender: 'female' }] })

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByLabelText('gender 1')).toBeInTheDocument()
    })

    mounted.screen.getByText('Remove').click()

    await waitFor(() => {
      expect(mounted.screen.queryByLabelText('gender 1')).not.toBeInTheDocument()
    })
  })

  it('writes what was typed into the element it belongs to', async () => {
    const mounted = mountPatient({ resourceType: 'Patient', id: 'p1', contact: [{ gender: 'female' }] })

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByLabelText('gender 1')).toBeInTheDocument()
    })

    type(mounted.screen.getByLabelText('gender 1'), 'other')

    await waitFor(() => {
      const raw: HTMLTextAreaElement = mounted.screen.getByLabelText('Raw')

      expect(raw.value).toContain('"gender": "other"')
    })
  })

  it('sets a flag where a server declares one', async () => {
    const mounted = mountPatient({ resourceType: 'Patient', id: 'p1' })

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByLabelText('active')).toBeInTheDocument()
    })

    mounted.screen.getByLabelText('active').click()

    await waitFor(() => {
      const raw: HTMLTextAreaElement = mounted.screen.getByLabelText('Raw')

      expect(raw.value).toContain('"active": true')
    })
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

describe('a form that knows what changed', () => {
  it('will not send a resource nobody changed', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Save')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Save')).toBeDisabled()
  })

  it('sends once something has changed', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Save')).toBeDisabled()
    })

    const raw: HTMLTextAreaElement = mounted.screen.getByLabelText('Raw')
    raw.value = JSON.stringify({ resourceType: 'Observation', id: 'o1', status: 'amended' })
    raw.dispatchEvent(new Event('input', { bubbles: true }))

    await waitFor(() => {
      expect(mounted.screen.getByText('Save')).toBeEnabled()
    })
  })

  it('always offers to create what does not exist yet', async () => {
    const mounted = mount([['/StructureDefinition', json(404, {})]], '#/type/Observation/new', true)

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('Create')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Create')).toBeEnabled()
  })
})

describe('a form that says what it will write', () => {
  it('says nothing while nothing has changed', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByLabelText('Raw')).toBeInTheDocument()
    })
    expect(mounted.screen.queryByTestId('willwrite')).not.toBeInTheDocument()
  })

  it('names what changed, and what it was before', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByLabelText('Raw')).toBeInTheDocument()
    })

    const raw: HTMLTextAreaElement = mounted.screen.getByLabelText('Raw')
    raw.value = JSON.stringify({ resourceType: 'Observation', id: 'o1', status: 'amended' })
    raw.dispatchEvent(new Event('input', { bubbles: true }))

    await waitFor(() => {
      expect(mounted.screen.getByTestId('willwrite')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('final')).toBeInTheDocument()
    expect(mounted.screen.getByText('amended')).toBeInTheDocument()
  })
})

describe('a page that writes, as a reader meets it', () => {
  it('names itself as a reader would say it, not as two words joined', async () => {
    const changing = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ],
      '#/type/Observation/o1/edit'
    )

    await changing.connect()

    await waitFor(() => {
      expect(changing.screen.getByRole('heading', { name: 'Editing Observation' })).toBeInTheDocument()
    })
    expect(changing.screen.queryByRole('heading', { name: 'Observation Save' })).not.toBeInTheDocument()
  })

  it('names a page that makes something new for what it will make', async () => {
    const making = mount([['/StructureDefinition', json(404, {})]], '#/type/Observation/new', true)

    await making.connect()

    await waitFor(() => {
      expect(making.screen.getByRole('heading', { name: 'New Observation' })).toBeInTheDocument()
    })
  })

  it('holds the resource from its beginning', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByLabelText('Raw')).toBeInTheDocument()
    })
    const raw: HTMLTextAreaElement = mounted.screen.getByLabelText('Raw')

    expect(raw.value.startsWith('{')).toBe(true)
    expect(raw.value.split('\n')[1]).toContain('resourceType')
    expect(raw.scrollTop).toBe(0)
  })

  it('sets the action that destroys apart from the one that saves', async () => {
    const mounted = mount(
      [
        ['/Observation/o1', json(200, observation)],
        ['/StructureDefinition', json(404, {})]
      ],
      '#/type/Observation/o1/edit'
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })
    const remove = mounted.screen.getByRole('button', { name: 'Delete' })
    const save = mounted.screen.getByRole('button', { name: 'Save' })

    expect(remove.classList.contains('danger')).toBe(true)
    expect(save.classList.contains('primary')).toBe(true)
    expect(remove.previousElementSibling).not.toBe(save)
  })
})

