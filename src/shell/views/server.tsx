import type { JSX } from 'solid-js'
import { Show, createSignal } from 'solid-js'
import { Status } from '../status'
import { useConnection } from '../server'
import { useText } from '../text'

export function ServerView(): JSX.Element {
  const connection = useConnection()
  const text = useText()
  const [wanted, setWanted] = createSignal(connection.address())

  return (
    <section class="page">
      <h1>{text.say('server.title')}</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void connection.connect(wanted())
        }}
      >
        <label>
          {text.say('server.address')}
        </label>
        <input
          id="address"
          name="address"
          aria-label={text.say('server.address')}
          value={wanted()}
          onInput={(event) => {
            setWanted(event.currentTarget.value)
          }}
        />
        <button class="primary" type="submit">{text.say('server.connect')}</button>
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
              void connection.signIn('#/')
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
    </section>
  )
}
