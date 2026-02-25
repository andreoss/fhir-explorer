import type { JSX } from 'solid-js'
import { A } from '@solidjs/router'
import { Show } from 'solid-js'
import { useConnection } from './server'
import { Surface } from './surface'
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
      </nav>
      <Surface />
      {props.children}
    </main>
  )
}
