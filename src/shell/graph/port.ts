import type { Graph, NodeKey } from '../../domain/graph'

export type Painted = {
  show: (graph: Graph, focus: NodeKey) => void
  onChoose: (choose: (key: NodeKey) => void) => void
  fit: () => void
  zoom: (by: number) => void
  destroy: () => void
}

export type Painter = (element: HTMLElement) => Painted

export type Fetching = () => Promise<Painter>
