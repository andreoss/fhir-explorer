import cytoscape from 'cytoscape'
import type { Core, ElementDefinition, NodeSingular } from 'cytoscape'
import type { Graph, NodeKey } from '../../domain/graph/model'
import type { Painted, Painter } from './port'

const STYLE = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'font-size': 9,
      'text-valign': 'center' as const,
      'text-halign': 'right' as const,
      'text-margin-x': 4,
      width: 14,
      height: 14,
      'background-color': '#8d97ab'
    }
  },
  {
    selector: 'node[?loaded]',
    style: { 'background-color': '#1f4fd8' }
  },
  {
    selector: 'node:selected',
    style: { 'background-color': '#a3261c', width: 20, height: 20 }
  },
  {
    selector: 'edge',
    style: {
      width: 1,
      'line-color': '#c3c9d6',
      'target-arrow-color': '#c3c9d6',
      'target-arrow-shape': 'triangle' as const,
      'curve-style': 'bezier' as const
    }
  }
]

function elementsOf(graph: Graph): ElementDefinition[] {
  return [
    ...graph.nodes.map((node) => ({
      data: { id: node.key, label: `${node.type}: ${node.display}`, loaded: node.loaded }
    })),
    ...graph.edges.map((edge) => ({
      data: { id: `${edge.from}|${edge.to}|${edge.path}`, source: edge.from, target: edge.to }
    }))
  ]
}

export const paintWithCytoscape: Painter = (element: HTMLElement): Painted => {
  const core: Core = cytoscape({ container: element, style: STYLE, elements: [] })
  let chosen: ((key: NodeKey) => void) | undefined

  core.on('tap', 'node', (event) => {
    const node = event.target as NodeSingular

    chosen?.(node.id())
  })

  return {
    show: (graph, focus) => {
      core.json({ elements: elementsOf(graph) })
      core.layout({ name: 'cose', animate: false, fit: true, padding: 20 }).run()
      core.nodes().unselect()
      core.getElementById(focus).select()
    },
    onChoose: (choose) => {
      chosen = choose
    },
    destroy: () => {
      core.destroy()
    }
  }
}
