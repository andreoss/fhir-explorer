import type { JSX } from 'solid-js'
import { A } from '@solidjs/router'
import { For, Show, createMemo, createSignal } from 'solid-js'
import { Empty } from '../states'
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
      <p class="sticky-filter">
        <input
          aria-label={text.say('types.search')}
          placeholder={text.say('types.search')}
          value={filter()}
          onInput={(event) => {
            setFilter(event.currentTarget.value)
          }}
        />
        <span class="quiet" data-testid="counted">
          {String(shown().length)} {text.say('types.count')}
        </span>
      </p>
      <Show when={shown().length > 0} fallback={<Empty say="types.none" />}>
        <ul class="types">
          <For each={shown()}>
            {(entry) => (
              <li>
                <A href={`/type/${entry.type}`}>{entry.type}</A>
                <span class="marks">
                  <Show when={entry.interactions.includes('search-type')}>
                    <span class="mark" title={text.say('types.searchable')}>
                      {text.say('types.searchable')}
                    </span>
                  </Show>
                  <Show when={entry.interactions.includes('update') || entry.interactions.includes('create')}>
                    <span class="mark" title={text.say('types.writable')}>
                      {text.say('types.writable')}
                    </span>
                  </Show>
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
