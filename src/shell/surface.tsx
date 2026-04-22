import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { useTroubles } from './errors'
import { useText } from './text'

export function Surface(): JSX.Element {
  const troubles = useTroubles()
  const text = useText()

  return (
    <>
      <Show when={troubles.said().length > 0}>
        <aside class="surface said" aria-live="polite" data-testid="said">
          <For each={troubles.said()}>{(one) => <p class="note">{one.message}</p>}</For>
        </aside>
      </Show>
      <Show when={troubles.all().length > 0}>
        <aside class="surface" aria-label={text.say('error.title')} aria-live="assertive">
          <For each={troubles.all()}>
          {(trouble) => (
            <p class="trouble">
              <span class="where">{trouble.at}</span>
              <span class="what">{trouble.message}</span>
              <button
                class="small quiet"
                type="button"
                onClick={() => {
                  troubles.dismiss(trouble.id)
                }}
              >
                {text.say('error.dismiss')}
              </button>
            </p>
          )}
        </For>
        </aside>
      </Show>
    </>
  )
}
