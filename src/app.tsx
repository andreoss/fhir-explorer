import type { JSX } from 'solid-js'
import { HashRouter, Route } from '@solidjs/router'
import { onMount } from 'solid-js'
import type { Environment } from './shell/environment'
import { browserEnvironment } from './shell/environment'
import { ConnectionProvider, useConnection } from './shell/server'
import { TroubleProvider } from './shell/errors'
import { Layout } from './shell/layout'
import { BrowseView } from './shell/views/browse'
import { GraphView } from './shell/views/graph'
import { HistoryView } from './shell/views/history'
import { ResourceView } from './shell/views/resource'
import { VersionView } from './shell/views/version'
import { ServerView } from './shell/views/server'
import { TypesView } from './shell/views/types'
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
      props.environment.replace(withoutAnswer(here))

      if (returnTo !== undefined && returnTo.length > 0) {
        props.environment.setHash(returnTo)
      }
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
              <Route path="/types" component={TypesView} />
              <Route path="/type/:type" component={BrowseView} />
              <Route path="/type/:type/:id" component={ResourceView} />
              <Route path="/type/:type/:id/history" component={HistoryView} />
              <Route path="/type/:type/:id/version/:version" component={VersionView} />
              <Route path="/graph/:type/:id" component={GraphView} />
              <Route path="*" component={ServerView} />
            </HashRouter>
          </Returning>
        </ConnectionProvider>
      </TroubleProvider>
    </TextProvider>
  )
}
