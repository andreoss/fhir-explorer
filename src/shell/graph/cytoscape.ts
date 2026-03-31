import cytoscape from 'cytoscape'
import type { Core, ElementDefinition, NodeSingular } from 'cytoscape'
import type { Graph, NodeKey } from '../../domain/graph/model'
import type { Painted, Painter } from './port'

const STYLE = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'font-size': 11,
      'font-family': 'system-ui, sans-serif',
      'text-valign': 'bottom' as const,
      'text-halign': 'center' as const,
      'text-margin-y': 4,
      'text-wrap': 'ellipsis' as const,
      'text-max-width': '140px',
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.85,
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle' as const,
      width: 16,
      height: 16,
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
      const held = core.getElementById(focus)

      core
        .layout({
          name: 'breadthfirst',
          animate: false,
          fit: true,
          padding: 48,
          spacingFactor: 1.5,
          directed: false,
          grid: true,
          ...(held.length > 0 ? { roots: [focus] } : {})
        })
        .run()

      if (core.zoom() > 1.4) {
        core.zoom({ level: 1.4, renderedPosition: { x: core.width() / 2, y: core.height() / 2 } })
        core.center()
      }
      core.nodes().unselect()
      held.select()
    },
    onChoose: (choose) => {
      chosen = choose
    },
    destroy: () => {
      core.destroy()
    }
  }
}
