import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json } from '@lib/stub'
import { mount, observation, patient } from '../../test/graph'

describe('the graph view', () => {
  it('starts from the resource it was opened on', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('1')
    })
    expect(mounted.screen.getByTestId('focus').textContent).toBe('Patient/p1')
  })

  it('draws what points at the resource, asked through declared parameters', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('2')
    })
    expect(mounted.painted.last()?.graph.edges).toEqual([
      { from: 'Observation/o1', to: 'Patient/p1', path: 'subject' }
    ])
    expect(mounted.stub.requests.some((request) => request.url.includes('subject=Patient%2Fp1'))).toBe(true)
  })

  it('grows when a node is chosen in the drawing', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation/o1', json(200, observation)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('2')
    })

    mounted.painted.choose('Observation/o1')

    await waitFor(() => {
      expect(mounted.screen.getByTestId('focus').textContent).toBe('Observation/o1')
    })
  })

  it('lists what touches the node in focus and expands it when asked', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation/o1', json(200, observation)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getAllByText(/Observation: a measurement/).length).toBeGreaterThan(0)
    })

    mounted.screen.getByText('Expand').click()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('focus').textContent).toBe('Observation/o1')
    })
  })

  it('reports a resource the server would not give, and keeps the rest', async () => {
    const mounted = mount([
      ['/Patient/p1', json(404, { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] })],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('This resource points nowhere')).toBeInTheDocument()
    })
  })

  it('hands the drawing to whatever was given to draw it', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.painted.shown.length).toBeGreaterThan(0)
    })
    expect(mounted.painted.last()?.focus).toBe('Patient/p1')
  })
})

describe('a graph a reader can steer and read', () => {
  it('says what its colours mean', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText('In focus')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('Read')).toBeInTheDocument()
    expect(mounted.screen.getByText('Not read yet')).toBeInTheDocument()
  })

  it('fits and zooms the drawing it was given', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByText('Fit')).toBeInTheDocument()
    })

    mounted.screen.getByText('Fit').click()
    mounted.screen.getByText('Closer').click()
    mounted.screen.getByText('Further').click()

    expect(mounted.painted.steered).toEqual(['fit', 'zoom 1.3', `zoom ${String(1 / 1.3)}`])
  })

  it('reads the resource in focus without leaving the graph', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, { ...patient, gender: 'female', birthDate: '1979-12-10' })],
      ['/Observation?', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('inspected')).toBeInTheDocument()
    })
    expect(mounted.screen.getByText('female')).toBeInTheDocument()
    expect(mounted.screen.getByText('Dec 10, 1979')).toBeInTheDocument()
  })
})

describe('a graph a reader can start again', () => {
  it('says how it is used', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?', json(200, { resourceType: 'Bundle' })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByText(/Choose a node to put it in focus/)).toBeInTheDocument()
    })
  })

  it('drops a node a reader is done with', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('2')
    })

    mounted.screen.getByLabelText('Drop Observation/o1').click()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('1')
    })
  })

  it('starts again from the resource it was opened on', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()
    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('2')
    })

    mounted.screen.getByText('Start again').click()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('focus').textContent).toBe('Patient/p1')
    })
  })
})

describe('an edge that says what made it', () => {
  it('names the element the reference came from', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getAllByText(/Observation: a measurement/).length).toBeGreaterThan(0)
    })
    expect(mounted.screen.getByText('subject')).toBeInTheDocument()
  })
})
