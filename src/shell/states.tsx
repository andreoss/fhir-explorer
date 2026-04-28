import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { TextKey } from '../i18n'
import { useText } from './text'

export function Busy(props: { readonly when: boolean }): JSX.Element {
  const text = useText()

  return (
    <p class="busy" role="status" aria-live="polite" data-testid="busy">
      <Show when={props.when}>{text.say('state.busy')}</Show>
    </p>
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
