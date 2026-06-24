import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { Graph, NodeKey } from '../../domain/graph'
import { neighboursOf, pathBetween } from '../../domain/graph'
import { useText } from '../text'

export function Pointing(props: {
  readonly graph: Graph
  readonly focus: NodeKey
  readonly onOpen: (key: NodeKey) => void
  readonly onDrop: (key: NodeKey) => void
}): JSX.Element {
  const text = useText()

  return (
    <ul class="pointing">
      <For each={neighboursOf(props.graph, props.focus)}>
        {(node) => (
          <li>
            <button
              class="small"
              type="button"
              onClick={() => {
                props.onOpen(node.key)
              }}
            >
              {text.say('graph.expand')}
            </button>
            <span>
              {node.type}: {node.display}
            </span>
            <Show when={pathBetween(props.graph, props.focus, node.key)}>
              {(path) => <span class="quiet mono">{path()}</span>}
            </Show>
            <button
              class="small quiet"
              type="button"
              aria-label={`${text.say('graph.drop')} ${node.key}`}
              onClick={() => {
                props.onDrop(node.key)
              }}
            >
              {text.say('graph.drop')}
            </button>
          </li>
        )}
      </For>
    </ul>
  )
}
