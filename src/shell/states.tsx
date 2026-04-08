import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { TextKey } from '../i18n'
import { useText } from './text'

export function Busy(props: { readonly when: boolean }): JSX.Element {
  const text = useText()

  return (
    <Show when={props.when}>
      <p class="busy" role="status" data-testid="busy">
        {text.say('state.busy')}
      </p>
    </Show>
  )
}

export function Empty(props: { readonly say: TextKey }): JSX.Element {
  const text = useText()

  return (
    <p class="empty" data-testid="empty">
      {text.say(props.say)}
    </p>
  )
}

export function Refused(props: { readonly say: TextKey }): JSX.Element {
  const text = useText()

  return (
    <p class="empty" data-testid="refused">
      {text.say(props.say)}
    </p>
  )
}
