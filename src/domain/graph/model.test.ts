import { describe, expect, it } from 'vitest'
import {
  EMPTY,
  cappedAt,
  grownFrom,
  grownTowards,
  keyOf,
  neighboursOf,
  nodeOf,
  placeholder,
  sizeOf,
  unloadedOf,
  withEdge,
  withNode,
  withoutNode
} from './model'

const observation = {
  resourceType: 'Observation',
  id: 'o1',
  code: { text: 'a measurement' },
  subject: { reference: 'Patient/p1', display: 'Ada' },
  performer: [{ reference: 'Practitioner/d1' }]
}

describe('the graph', () => {
  it('grows a node for what was read and one for each thing it points at', () => {
    const graph = grownFrom(EMPTY, observation)

    expect(sizeOf(graph)).toBe(3)
    expect(graph.edges).toHaveLength(2)
    expect(graph.nodes[0]).toMatchObject({ key: 'Observation/o1', display: 'a measurement', loaded: true })
    expect(graph.nodes[1]).toMatchObject({ key: 'Patient/p1', display: 'Ada', loaded: false })
  })

  it('knows which of its nodes have not been read', () => {
    const graph = grownFrom(EMPTY, observation)

    expect(unloadedOf(graph).map((node) => node.key)).toEqual(['Patient/p1', 'Practitioner/d1'])
  })

  it('replaces a placeholder when the resource itself arrives', () => {
    const graph = grownFrom(EMPTY, observation)

    const grown = withNode(graph, nodeOf({ resourceType: 'Patient', id: 'p1', name: [{ family: 'Lovelace' }] }))

    expect(sizeOf(grown)).toBe(3)
    expect(grown.nodes.find((node) => node.key === 'Patient/p1')).toMatchObject({
      display: 'Lovelace',
      loaded: true
    })
  })

  it('keeps what it read when a placeholder for it arrives later', () => {
    const graph = withNode(EMPTY, nodeOf({ resourceType: 'Patient', id: 'p1', name: [{ family: 'Lovelace' }] }))

    const grown = withNode(graph, placeholder('Patient', 'p1', 'Ada'))

    expect(grown.nodes[0]).toMatchObject({ display: 'Lovelace', loaded: true })
  })

  it('never draws the same edge twice, nor one to itself', () => {
    const once = grownFrom(EMPTY, observation)
    const twice = grownFrom(once, observation)

    expect(twice.edges).toHaveLength(2)
    expect(withEdge(twice, { from: 'Observation/o1', to: 'Observation/o1', path: 'self' }).edges).toHaveLength(2)
  })

  it('terminates where a resource points at itself', () => {
    const graph = grownFrom(EMPTY, { resourceType: 'Patient', id: 'p1', link: [{ other: { reference: 'Patient/p1' } }] })

    expect(graph.edges).toHaveLength(0)
    expect(sizeOf(graph)).toBe(1)
  })

  it('grows towards a node from something that points at it', () => {
    const graph = withNode(EMPTY, placeholder('Patient', 'p1'))

    const grown = grownTowards(graph, keyOf('Patient', 'p1'), observation)

    expect(grown.edges).toEqual([{ from: 'Observation/o1', to: 'Patient/p1', path: 'subject' }])
  })

  it('ignores what does not point at the node it was grown towards', () => {
    const graph = withNode(EMPTY, placeholder('Patient', 'other'))

    const grown = grownTowards(graph, keyOf('Patient', 'other'), observation)

    expect(grown.edges).toHaveLength(0)
    expect(sizeOf(grown)).toBe(2)
  })

  it('names what touches a node, whichever way the edge runs', () => {
    const graph = grownTowards(grownFrom(EMPTY, observation), keyOf('Patient', 'p1'), {
      resourceType: 'Encounter',
      id: 'e1',
      subject: { reference: 'Patient/p1' }
    })

    expect(neighboursOf(graph, 'Patient/p1').map((node) => node.key).sort()).toEqual([
      'Encounter/e1',
      'Observation/o1'
    ])
  })

  it('holds nothing to begin with', () => {
    expect(sizeOf(EMPTY)).toBe(0)
    expect(neighboursOf(EMPTY, 'Patient/p1')).toHaveLength(0)
  })
})

describe('the graph at its limit', () => {
  it('stops taking nodes once it is full', () => {
    const full = grownFrom(EMPTY, { resourceType: 'Thing', id: 't', at: { reference: 'Other/1' } }, 2)

    const grown = grownFrom(full, { resourceType: 'Another', id: 'a', at: { reference: 'More/2' } }, 2)

    expect(sizeOf(grown)).toBe(2)
    expect(cappedAt(grown, 2)).toBe(true)
  })

  it('draws no edge to a node it had no room for', () => {
    const graph = grownFrom(EMPTY, { resourceType: 'Thing', id: 't', at: { reference: 'Other/1' } }, 1)

    expect(sizeOf(graph)).toBe(1)
    expect(graph.edges).toHaveLength(0)
  })

  it('is not full while it has room', () => {
    expect(cappedAt(EMPTY, 2)).toBe(false)
  })
})

describe('a node a reader dropped', () => {
  it('is gone, and so is every edge that touched it', () => {
    const graph = grownFrom(EMPTY, observation)

    const smaller = withoutNode(graph, 'Patient/p1')

    expect(smaller.nodes.map((node) => node.key)).toEqual(['Observation/o1', 'Practitioner/d1'])
    expect(smaller.edges.map((edge) => edge.to)).toEqual(['Practitioner/d1'])
  })

  it('leaves a graph alone when it held no such node', () => {
    const graph = grownFrom(EMPTY, observation)

    expect(withoutNode(graph, 'Patient/nobody')).toEqual(graph)
  })
})
