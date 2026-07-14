import type { JSX } from 'solid-js'
import { For, Show, createMemo, createSignal } from 'solid-js'
import type { Asking } from '@lib/graph'
import { useText } from '../text'

const SHOWN_AT_FIRST = 12

export function Ways(props: {
  readonly asking: readonly Asking[]
  readonly answered: Readonly<Record<string, number>>
  readonly recent: readonly string[]
  readonly onAsk: (type: string) => void
  readonly unasked: boolean
}): JSX.Element {
  const text = useText()
  const [ways, setWays] = createSignal('')

  const matching = createMemo(() => {
    const wanted = ways().toLowerCase()
    const before = props.recent
    const found = props.asking.filter((entry) => entry.type.toLowerCase().includes(wanted))
    const first = (type: string): number => {
      const at = before.indexOf(type)

      return at < 0 ? before.length : at
    }

    return [...found].sort((one, other) => first(one.type) - first(other.type) || one.type.localeCompare(other.type))
  })

  const shown = createMemo(() => (ways().length > 0 ? matching() : matching().slice(0, SHOWN_AT_FIRST)))
  const held = createMemo(() => matching().length - shown().length)

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
        <For each={shown()}>
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
      <Show when={held() > 0}>
        <p class="quiet" data-testid="more-ways">
          {held()} {text.say('graph.more')}
        </p>
      </Show>
    </details>
  )
}
