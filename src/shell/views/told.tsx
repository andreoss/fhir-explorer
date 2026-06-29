import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { readable } from '@lib/fhir'
import type { Graph } from '@lib/graph'
import { toldOf } from '@lib/graph'
import { useText } from '../text'

export function Told(props: { readonly graph: Graph }): JSX.Element {
  const text = useText()

  return (
    <details class="told" data-testid="told">
      <summary>{text.say('graph.told')}</summary>
      <ul>
        <For each={toldOf(props.graph)}>
          {(told) => (
            <li>
              <span>{told.said}</span>
              <Show when={told.points.length > 0}>
                <ul>
                  <For each={told.points}>
                    {(pointing) => (
                      <li>
                        <span class="quiet">{readable(pointing.path)}</span> {pointing.said}
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </details>
  )
}
