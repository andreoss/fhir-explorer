import cytoscape from 'cytoscape'
import type { Core, ElementDefinition, NodeSingular } from 'cytoscape'
import type { Graph, NodeKey } from '../../domain/graph/model'
import type { Painted, Painter } from './port'

export function tokens(element: HTMLElement): Readonly<Record<string, string>> {
  const held = globalThis.getComputedStyle(element)
  const at = (name: string, fallback: string): string => {
    const found = held.getPropertyValue(name).trim()

    return found.length > 0 ? found : fallback
  }

  return {
    read: at('--accent', '#2b55e0'),
    unread: at('--quiet', '#5a6474'),
    focus: at('--alarm', '#b32318'),
    line: at('--line', '#dfe4ee'),
    paper: at('--raised', '#f6f8fb'),
    ink: at('--ink', '#13161c')
  }
}

export function styleOf(colour: Readonly<Record<string, string>>) {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'font-size': 12,
        'font-family': 'system-ui, sans-serif',
        color: colour.ink ?? '',
        'text-valign': 'bottom' as const,
        'text-halign': 'center' as const,
        'text-margin-y': 4,
        'text-wrap': 'ellipsis' as const,
        'text-max-width': '180px',
        'text-background-color': colour.paper ?? '',
        'text-background-opacity': 0.9,
        'text-background-padding': '2px',
        'text-background-shape': 'roundrectangle' as const,
        width: 24,
        height: 24,
        'background-color': colour.unread ?? ''
      }
    },
    {
      selector: 'node[?loaded]',
      style: { 'background-color': colour.read ?? '' }
    },
    {
      selector: 'node:selected',
      style: { 'background-color': colour.focus ?? '', width: 34, height: 34 }
    },
    {
      selector: 'edge',
      style: {
        width: 2,
        'line-color': colour.unread ?? '',
        'target-arrow-color': colour.unread ?? '',
        'target-arrow-shape': 'triangle' as const,
        'curve-style': 'bezier' as const
      }
    }
  ]
}

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
  const core: Core = cytoscape({ container: element, style: styleOf(tokens(element)), elements: [] })
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
          padding: 28,
          spacingFactor: 1.7,
          directed: false,
          grid: true,
          ...(held.length > 0 ? { roots: [focus] } : {})
        })
        .run()

      if (core.zoom() > 1.3) {
        core.zoom({ level: 1.3, renderedPosition: { x: core.width() / 2, y: core.height() / 2 } })
        core.center()
      }
      core.nodes().unselect()
      held.select()
    },
    onChoose: (choose) => {
      chosen = choose
    },
    fit: () => {
      core.fit(undefined, 28)
    },
    zoom: (by) => {
      core.zoom({ level: core.zoom() * by, renderedPosition: { x: core.width() / 2, y: core.height() / 2 } })
    },
    destroy: () => {
      core.destroy()
    }
  }
}
