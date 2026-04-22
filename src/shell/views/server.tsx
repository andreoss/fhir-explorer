import type { JSX } from 'solid-js'
import { For, Show, createSignal } from 'solid-js'
import { Status } from '../status'
import { useConnection } from '../server'
import { useText } from '../text'
import { useTitle } from '../title'

export function ServerView(): JSX.Element {
  const connection = useConnection()
  const text = useText()
  const [wanted, setWanted] = createSignal(connection.address())

  useTitle(() => text.say('server.title'))

  const reach = (address: string): void => {
    setWanted(address)
    void connection.connect(address)
  }

  return (
    <section class="page">
      <h1>{text.say('server.title')}</h1>
      <div class="card">
        <p class="note">{text.say('server.what')}</p>
        <p class="note">{text.say('server.how')}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            reach(wanted())
          }}
        >
          <label for="address">{text.say('server.address')}</label>
          <input
            id="address"
            name="address"
            aria-label={text.say('server.address')}
            placeholder="https://example.org/fhir"
            value={wanted()}
            onInput={(event) => {
              setWanted(event.currentTarget.value)
            }}
          />
          <button class="primary" type="submit">
            {text.say('server.connect')}
          </button>
        </form>
        <Status />
        <Show
          when={connection.signedIn()}
          fallback={
            <button
              class="primary"
              type="button"
              disabled={connection.configuration() === undefined}
              onClick={() => {
                void connection.signIn('#/types')
              }}
            >
              {text.say('session.start')}
            </button>
          }
        >
          <button
            type="button"
            onClick={() => {
              connection.signOut()
            }}
          >
            {text.say('session.end')}
          </button>
        </Show>
      </div>
      <Show when={connection.before().length > 0}>
        <section class="card" aria-label={text.say('server.before')}>
          <h2>{text.say('server.before')}</h2>
          <ul class="pointing" data-testid="before">
            <For each={connection.before()}>
              {(address) => (
                <li>
                  <button
                    class="small"
                    type="button"
                    onClick={() => {
                      reach(address)
                    }}
                  >
                    {address}
                  </button>
                  <button
                    class="small quiet"
                    type="button"
                    aria-label={`${text.say('server.forget')} ${address}`}
                    onClick={() => {
                      connection.forget(address)
                    }}
                  >
                    {text.say('server.forget')}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </section>
  )
}
