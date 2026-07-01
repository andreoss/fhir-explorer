import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json } from '@lib/stub'
import { mount, observation } from '../../test/edit'

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
