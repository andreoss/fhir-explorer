import type { JSX } from 'solid-js'
import { HashRouter } from '@solidjs/router'
import { render } from '@solidjs/testing-library'
import type { Environment } from '../shell/environment'
import { TroubleProvider } from '../shell/errors'
import { ConnectionProvider } from '../shell/server'
import { TextProvider } from '../shell/text'

export const discovery = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: [],
  capabilities: []
}

export function renderUnder(environment: Environment, routes: () => JSX.Element) {
  return render(() => (
    <TextProvider>
      <TroubleProvider>
        <ConnectionProvider environment={environment}>
          <HashRouter>{routes()}</HashRouter>
        </ConnectionProvider>
      </TroubleProvider>
    </TextProvider>
  ))
}
