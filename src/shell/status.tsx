import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { TextKey } from '../i18n'
import { useConnection } from './server'
import { useText } from './text'

const SAID: Readonly<Record<string, TextKey>> = {
  idle: 'server.idle',
  asking: 'server.connecting',
  reachable: 'server.reachable',
  unreachable: 'server.unreachable',
  unsupported: 'server.unsupported'
}

export function Status(): JSX.Element {
  const connection = useConnection()
  const text = useText()

  return (
    <p class="status" data-standing={connection.standing()}>
      <span data-testid="standing">{text.say(SAID[connection.standing()] ?? 'server.unreachable')}</span>
      <Show when={connection.capability()}>
        {(capability) => (
          <>
            <span class="fact">
              {text.say('server.release')}: {capability().fhirVersion ?? '-'}
            </span>
            <Show when={capability().software}>
              {(software) => (
                <span class="fact">
                  {text.say('server.software')}: {software()}
                </span>
              )}
            </Show>
          </>
        )}
      </Show>
      <span class="fact" data-testid="session">
        {connection.signedIn()
          ? text.say(connection.expired() ? 'session.expired' : 'session.holding')
          : text.say('session.none')}
      </span>
    </p>
  )
}
