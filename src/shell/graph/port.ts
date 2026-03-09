import type { Graph, NodeKey } from '../../domain/graph/model'

export type Painted = {
  show: (graph: Graph, focus: NodeKey) => void
  onChoose: (choose: (key: NodeKey) => void) => void
  destroy: () => void
}

export type Painter = (element: HTMLElement) => Painted
