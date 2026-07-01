import { waitFor } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { json } from '@lib/stub'
import type { Graph, NodeKey } from '@lib/graph'
import type { Fetching, Painted, Painter } from '../graph/port'
import { mount, observation, patient } from '../../test/graph'

describe('a renderer that arrives after the page', () => {
  function awaited() {
    const shown: { graph: Graph; focus: NodeKey }[] = []
    let made = 0
    let arrive: ((paint: Painter) => void) | undefined

    const painter: Painter = (): Painted => {
      made += 1

      return {
        show: (graph, focus) => {
          shown.push({ graph, focus })
        },
        onChoose: () => undefined,
        fit: () => undefined,
        zoom: () => undefined,
        destroy: () => undefined
      }
    }

    const fetching: Fetching = () =>
      new Promise<Painter>((settle) => {
        arrive = settle
      })

    return {
      fetching,
      shown,
      made: () => made,
      arrive: () => {
        arrive?.(painter)
      }
    }
  }

  async function settled(): Promise<void> {
    await new Promise<void>((done) => {
      setTimeout(done, 0)
    })
  }

  it('draws nothing until the renderer is there, then draws what is already on the page', async () => {
    const held = awaited()
    const mounted = mount(
      [
        ['/Patient/p1', json(200, patient)],
        ['/Observation?', json(200, { resourceType: 'Bundle' })]
      ],
      held.fetching
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('size').textContent).toBe('1')
    })
    expect(held.shown).toHaveLength(0)

    held.arrive()

    await waitFor(() => {
      expect(held.shown.at(-1)?.focus).toBe('Patient/p1')
    })
  })

  it('says the drawing is coming while the renderer is fetched', async () => {
    const held = awaited()
    const mounted = mount(
      [
        ['/Patient/p1', json(200, patient)],
        ['/Observation?', json(200, { resourceType: 'Bundle' })]
      ],
      held.fetching
    )

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('surface')).toBeInTheDocument()
    })
    expect(mounted.screen.getAllByTestId('busy').some((one) => one.textContent !== '')).toBe(true)

    held.arrive()

    await waitFor(() => {
      expect(mounted.screen.getAllByTestId('busy').every((one) => one.textContent === '')).toBe(true)
    })
  })

  it('draws nothing when the reader has left before the renderer arrives', async () => {
    const held = awaited()
    const mounted = mount(
      [
        ['/Patient/p1', json(200, patient)],
        ['/Observation?', json(200, { resourceType: 'Bundle' })]
      ],
      held.fetching
    )

    await mounted.connect()
    mounted.screen.unmount()
    held.arrive()
    await settled()

    expect(held.made()).toBe(0)
  })
})

describe('a graph a reader cannot see', () => {
  it('offers the same graph as text, naming each node and each edge', async () => {
    const mounted = mount([
      ['/Patient/p1', json(200, patient)],
      ['/Observation?subject=', json(200, { resourceType: 'Bundle', entry: [{ resource: observation }] })]
    ])

    await mounted.connect()

    await waitFor(() => {
      expect(mounted.screen.getByTestId('told').textContent).toContain('Observation: a measurement')
    })
    const told = mounted.screen.getByTestId('told')

    expect(told.textContent).toContain('Observation: a measurement')
    expect(told.textContent).toContain('Subject')
  })

})
