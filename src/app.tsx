import type { JSX } from 'solid-js'
import { HashRouter, Route } from '@solidjs/router'
import { onMount } from 'solid-js'
import type { Environment } from './shell/environment'
import { browserEnvironment } from './shell/environment'
import { ConnectionProvider, useConnection } from './shell/server'
import { TroubleProvider } from './shell/errors'
import { Layout } from './shell/layout'
import { ServerView } from './shell/views/server'
import { TextProvider } from './shell/text'
import { answerOf, withoutAnswer } from './shell/launching'

function Returning(props: { readonly environment: Environment; readonly children: JSX.Element }): JSX.Element {
  const connection = useConnection()

  onMount(() => {
    const here = props.environment.here()
    const answer = answerOf(here)

    if (answer === undefined) {
      return
    }

    void connection.complete(answer).then((returnTo) => {
      const back = new URL(withoutAnswer(here))

      back.hash = returnTo ?? here.hash

      props.environment.go(back.toString())
    })
  })

  return props.children
}

export function App(props: { readonly environment?: Environment }): JSX.Element {
  const environment = props.environment ?? browserEnvironment()

  return (
    <TextProvider>
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <Returning environment={environment}>
            <HashRouter root={Layout}>
              <Route path="/" component={ServerView} />
              <Route path="*" component={ServerView} />
            </HashRouter>
          </Returning>
        </ConnectionProvider>
      </TroubleProvider>
    </TextProvider>
  )
}
