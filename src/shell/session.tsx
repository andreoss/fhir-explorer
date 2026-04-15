import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { useLocation } from '@solidjs/router'
import { useConnection } from './server'
import { useText } from './text'

export function SessionNeeded(): JSX.Element {
  const connection = useConnection()
  const location = useLocation()
  const text = useText()

  const somewhere = (): boolean => location.pathname !== '/' && location.pathname.length > 1

  return (
    <>
      <Show when={connection.capability() !== undefined && !connection.signedIn() && somewhere()}>
        <p class="surface" data-testid="needed">
          <span>{text.say('session.needed')}</span>
          <button
            class="primary small"
            type="button"
            onClick={() => {
              void connection.signIn(`#${location.pathname}${location.search}`)
            }}
          >
            {text.say('session.start')}
          </button>
        </p>
      </Show>
      <Show when={connection.signedIn() && connection.expired()}>
        <p class="surface" data-testid="ran-out">
          <span>{text.say('session.expired')}</span>
          <button
            class="primary small"
            type="button"
            onClick={() => {
              void connection.renew()
            }}
          >
            {text.say('session.renew')}
          </button>
        </p>
      </Show>
    </>
  )
}
