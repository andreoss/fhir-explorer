import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { readable } from '@lib/fhir'
import type { Change } from '@lib/form'
import { useText } from '../text'

export function WillWrite(props: { readonly changes: readonly Change[] }): JSX.Element {
  const text = useText()

  return (
    <section class="card" aria-label={text.say('form.willwrite')} data-testid="willwrite">
      <h2>{text.say('form.willwrite')}</h2>
      <ul class="elements">
        <For each={props.changes}>
          {(change) => (
            <li class="element">
              <span class="name">{readable(change.path)}</span>
              <span class="value">
                <Show when={change.from.length > 0}>
                  <span class="was">{change.from}</span>
                </Show>
                <span>{change.to.length > 0 ? change.to : '—'}</span>
              </span>
            </li>
          )}
        </For>
      </ul>
    </section>
  )
}
