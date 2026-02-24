import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { useTroubles } from './errors'
import { useText } from './text'

export function Surface(): JSX.Element {
  const troubles = useTroubles()
  const text = useText()

  return (
    <Show when={troubles.all().length > 0}>
      <aside class="surface" aria-label={text.say('error.title')}>
        <For each={troubles.all()}>
          {(trouble) => (
            <p class="trouble">
              <span class="where">{trouble.at}</span>
              <span class="what">{trouble.message}</span>
              <button
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
  )
}
