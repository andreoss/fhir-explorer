import type { JSX } from 'solid-js'
import { A } from '@solidjs/router'
import { For, Show } from 'solid-js'
import { catalogueFor, languages } from '../i18n'
import { useConnection } from './server'
import { Surface } from './surface'
import { Trail } from './trail'
import { useText } from './text'

export function Layout(props: { readonly children?: JSX.Element }): JSX.Element {
  const text = useText()
  const connection = useConnection()

  return (
    <main dir={text.direction()}>
      <nav aria-label={text.say('nav.server')}>
        <A href="/">{text.say('nav.server')}</A>
        <Show when={connection.capability()}>
          <A href="/types">{text.say('nav.types')}</A>
        </Show>
        <select
          class="spacer"
          aria-label="language"
          value={text.language()}
          onChange={(event) => {
            text.choose(event.currentTarget.value)
          }}
        >
          <For each={languages()}>{(language) => <option value={language}>{catalogueFor(language).name}</option>}</For>
        </select>
      </nav>
      <Surface />
      <Trail />
      {props.children}
    </main>
  )
}
