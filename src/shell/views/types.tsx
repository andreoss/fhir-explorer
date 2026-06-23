import type { JSX } from 'solid-js'
import { A } from '@solidjs/router'
import { For, Show, createMemo, createSignal } from 'solid-js'
import type { TypeCapability } from '../../domain/conformance'
import { distinguishing, groupedBy, lettersOf, marksOf } from '../../domain/conformance'
import { middled } from '../../domain/fhir'
import { Empty } from '../states'
import { useConnection } from '../server'
import { useText } from '../text'
import { useTitle } from '../title'

const SHOWN_AT_MOST = 22

export function TypesView(): JSX.Element {
  const connection = useConnection()
  const text = useText()
  const [filter, setFilter] = createSignal('')

  useTitle(() => text.say('types.title'))

  const all = (): readonly TypeCapability[] => connection.capability()?.types ?? []

  const shown = createMemo(() => {
    const wanted = filter().toLowerCase()

    return all().filter((entry) => entry.type.toLowerCase().includes(wanted))
  })

  const worth = createMemo(() => distinguishing(all()))
  const recent = createMemo(() => connection.recentTypes().filter((type) => all().some((one) => one.type === type)))

  function Tile(props: { readonly entry: TypeCapability }): JSX.Element {
    const marks = (): ReturnType<typeof marksOf> => marksOf(props.entry)

    return (
      <li>
        <A href={`/type/${props.entry.type}`} title={props.entry.type}>
          {middled(props.entry.type, SHOWN_AT_MOST)}
        </A>
        <span class="marks">
          <Show when={worth().searchable && marks().searchable}>
            <span class="mark">{text.say('types.searchable')}</span>
          </Show>
          <Show when={worth().writable && marks().writable}>
            <span class="mark">{text.say('types.writable')}</span>
          </Show>
        </span>
      </li>
    )
  }

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
        <span class="letters">
          <For each={lettersOf(shown())}>
            {(letter) => (
              <a href={`#/types?at=${letter}`} onClick={() => setFilter(letter)}>
                {letter}
              </a>
            )}
          </For>
        </span>
      </p>
      <Show when={recent().length > 0 && filter().length === 0}>
        <section class="card" aria-label={text.say('types.recent')} data-testid="recent">
          <h2>{text.say('types.recent')}</h2>
          <ul class="types">
            <For each={recent()}>
              {(type) => (
                <Show when={all().find((one) => one.type === type)}>{(entry) => <Tile entry={entry()} />}</Show>
              )}
            </For>
          </ul>
        </section>
      </Show>
      <Show when={shown().length > 0} fallback={<Empty say="types.none" />}>
        <For each={groupedBy(shown())}>
          {([letter, entries]) => (
            <section aria-label={letter}>
              <h2 class="letter">{letter}</h2>
              <ul class="types">
                <For each={entries}>{(entry) => <Tile entry={entry} />}</For>
              </ul>
            </section>
          )}
        </For>
      </Show>
    </section>
  )
}
