import type { JSX } from 'solid-js'
import { A } from '@solidjs/router'
import { For, Show, createMemo, createSignal } from 'solid-js'
import { useConnection } from '../server'
import { useText } from '../text'

export function TypesView(): JSX.Element {
  const connection = useConnection()
  const text = useText()
  const [filter, setFilter] = createSignal('')

  const shown = createMemo(() => {
    const wanted = filter().toLowerCase()

    return (connection.capability()?.types ?? []).filter((entry) => entry.type.toLowerCase().includes(wanted))
  })

  return (
    <section class="page">
      <h1>{text.say('types.title')}</h1>
      <input
        aria-label={text.say('types.search')}
        value={filter()}
        onInput={(event) => {
          setFilter(event.currentTarget.value)
        }}
      />
      <Show when={shown().length > 0} fallback={<p>{text.say('types.none')}</p>}>
        <ul class="types">
          <For each={shown()}>
            {(entry) => (
              <li>
                <A href={`/type/${entry.type}`}>{entry.type}</A>
                <span class="quiet">{entry.interactions.join(' ')}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
