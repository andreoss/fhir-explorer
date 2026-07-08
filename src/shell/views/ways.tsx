import type { JSX } from 'solid-js'
import { For, Show, createSignal } from 'solid-js'
import type { Asking } from '@lib/graph'
import { useText } from '../text'

export function Ways(props: {
  readonly asking: readonly Asking[]
  readonly answered: Readonly<Record<string, number>>
  readonly onAsk: (type: string) => void
  readonly unasked: boolean
}): JSX.Element {
  const text = useText()
  const [ways, setWays] = createSignal('')

  return (
    <details class="asking" open={props.unasked}>
      <summary>
        {text.say('graph.inbound')} ({props.asking.length})
      </summary>
      <Show when={props.unasked}>
        <p class="note says">{text.say('graph.unasked')}</p>
      </Show>
      <input
        aria-label={text.say('graph.ways')}
        placeholder={text.say('graph.ways')}
        value={ways()}
        onInput={(event) => {
          setWays(event.currentTarget.value)
        }}
      />
      <ul class="types ways">
        <For each={props.asking.filter((entry) => entry.type.toLowerCase().includes(ways().toLowerCase()))}>
          {(entry) => (
            <li>
              <button
                class="small"
                type="button"
                onClick={() => {
                  props.onAsk(entry.type)
                }}
              >
                {entry.type}
              </button>
              <Show when={props.answered[entry.type] !== undefined}>
                <span class="quiet">
                  {props.answered[entry.type] === 0
                    ? text.say('graph.silent')
                    : `${String(props.answered[entry.type])} ${text.say('graph.answered')}`}
                </span>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </details>
  )
}
