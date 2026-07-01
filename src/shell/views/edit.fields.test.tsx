import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json } from '@lib/stub'
import { mount, type } from '../../test/edit'
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
