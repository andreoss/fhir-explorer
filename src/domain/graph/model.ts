import { displayOf } from '../fhir/display'
import { pointingFrom } from '../fhir/references'
import type { Resource } from '../fhir/types'

export type NodeKey = string

export type Node = {
  readonly key: NodeKey
  readonly type: string
  readonly id: string
  readonly display: string
  readonly loaded: boolean
}

export type Edge = {
  readonly from: NodeKey
  readonly to: NodeKey
  readonly path: string
}

export type Graph = {
  readonly nodes: readonly Node[]
  readonly edges: readonly Edge[]
}

export const EMPTY: Graph = { nodes: [], edges: [] }

export function keyOf(type: string, id: string): NodeKey {
  return `${type}/${id}`
}

function shortened(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

export function placeholder(type: string, id: string, display?: string): Node {
  return { key: keyOf(type, id), type, id, display: display ?? shortened(id), loaded: false }
}

export function nodeOf(resource: Resource): Node {
  const type = resource.resourceType
  const id = resource.id ?? ''

  return { key: keyOf(type, id), type, id, display: displayOf(resource), loaded: true }
}

function merged(kept: Node, found: Node): Node {
  if (found.loaded) {
    return found
  }

  return kept
}

export const LIMIT = 1000

export function cappedAt(graph: Graph, limit = LIMIT): boolean {
  return graph.nodes.length >= limit
}

export function withNode(graph: Graph, node: Node, limit = LIMIT): Graph {
  const at = graph.nodes.findIndex((held) => held.key === node.key)

  if (at < 0) {
    return cappedAt(graph, limit) ? graph : { nodes: [...graph.nodes, node], edges: graph.edges }
  }

  const kept = graph.nodes[at]

  if (kept === undefined) {
    return graph
  }

  const nodes = [...graph.nodes]

  nodes[at] = merged(kept, node)

  return { nodes, edges: graph.edges }
}

export function withEdge(graph: Graph, edge: Edge): Graph {
  const known = graph.edges.some(
    (held) => held.from === edge.from && held.to === edge.to && held.path === edge.path
  )

  if (known || edge.from === edge.to) {
    return graph
  }

  return { nodes: graph.nodes, edges: [...graph.edges, edge] }
}

export function grownFrom(graph: Graph, resource: Resource, limit = LIMIT): Graph {
  const node = nodeOf(resource)
  let grown = withNode(graph, node, limit)

  for (const pointing of pointingFrom(resource)) {
    const key = keyOf(pointing.type, pointing.id)

    grown = withNode(grown, placeholder(pointing.type, pointing.id, pointing.display), limit)

    if (grown.nodes.some((held) => held.key === key)) {
      grown = withEdge(grown, { from: node.key, to: key, path: pointing.path })
    }
  }

  return grown
}

export function grownTowards(graph: Graph, target: NodeKey, resource: Resource): Graph {
  const node = nodeOf(resource)
  let grown = withNode(graph, node)

  for (const pointing of pointingFrom(resource)) {
    if (keyOf(pointing.type, pointing.id) === target) {
      grown = withEdge(grown, { from: node.key, to: target, path: pointing.path })
    }
  }

  return grown
}

export function withoutNode(graph: Graph, key: NodeKey): Graph {
  return {
    nodes: graph.nodes.filter((node) => node.key !== key),
    edges: graph.edges.filter((edge) => edge.from !== key && edge.to !== key)
  }
}

export function neighboursOf(graph: Graph, key: NodeKey): readonly Node[] {
  const touching = graph.edges.filter((edge) => edge.from === key || edge.to === key)
  const keys = new Set(touching.map((edge) => (edge.from === key ? edge.to : edge.from)))

  return graph.nodes.filter((node) => keys.has(node.key))
}

export function pathBetween(graph: Graph, one: NodeKey, other: NodeKey): string | undefined {
  return graph.edges.find(
    (edge) => (edge.from === one && edge.to === other) || (edge.from === other && edge.to === one)
  )?.path
}

export function unloadedOf(graph: Graph): readonly Node[] {
  return graph.nodes.filter((node) => !node.loaded)
}

export function sizeOf(graph: Graph): number {
  return graph.nodes.length
}
