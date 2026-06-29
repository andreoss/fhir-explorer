import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { readable } from '@lib/fhir'
import { factsOf } from '@lib/fhir'
import type { Resource } from '@lib/fhir'
import { saidValue } from '../saying'
import { useText } from '../text'

export function Facts(props: { readonly resource: Resource; readonly many?: number }): JSX.Element {
  const text = useText()

  return (
    <ul class="elements">
      <For each={factsOf(props.resource, props.many)}>
        {(fact) => (
          <li class="element">
            <span class="name">{readable(fact.name)}</span>
            <span class="value">{saidValue(text, fact.said, fact.truth)}</span>
          </li>
        )}
      </For>
    </ul>
  )
}
