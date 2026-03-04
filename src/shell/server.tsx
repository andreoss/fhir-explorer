import type { JSX } from 'solid-js'
import { batch, createContext, createSignal, useContext } from 'solid-js'
import type { SmartConfiguration } from '../domain/auth/discovery'
import { discover } from '../domain/auth/discovery'
import type { Pending, Session } from '../domain/auth/launch'
import { beginLaunch, completeLaunch } from '../domain/auth/launch'
import type { Held } from '../domain/auth/session'
import { createSession, storedPending } from '../domain/auth/session'
import type { ServerCapability } from '../domain/conformance/capability'
import { capabilityOf } from '../domain/conformance/capability'
import type { Catalogue } from '../domain/conformance/catalogue'
import { createCatalogue } from '../domain/conformance/catalogue'
import { cachingHttp, createStore } from '../domain/transport/cache'
import type { Client } from '../domain/transport/client'
import { createClient } from '../domain/transport/client'
import type { Environment } from './environment'
import { useTroubles } from './errors'

export type Standing = 'idle' | 'asking' | 'reachable' | 'unreachable' | 'unsupported'

export type Connection = {
  address: () => string
  standing: () => Standing
  capability: () => ServerCapability | undefined
  configuration: () => SmartConfiguration | undefined
  client: () => Client | undefined
  catalogue: () => Catalogue | undefined
  signedIn: () => boolean
  expired: () => boolean
  connect: (address: string) => Promise<void>
  signIn: (returnTo: string) => Promise<void>
  complete: (params: Readonly<Record<string, string>>) => Promise<string | undefined>
  signOut: () => void
}

const ADDRESS = 'fhir-explorer.server'
const CLIENT_ID = 'explorer'

const ConnectionContext = createContext<Connection>()

export function redirectOf(environment: Environment): string {
  const here = environment.here()

  return `${here.origin}${here.pathname}`
}

export function ConnectionProvider(props: {
  readonly environment: Environment
  readonly children: JSX.Element
}): JSX.Element {
  const troubles = useTroubles()
  const held: Held = createSession(storedPending(props.environment.session), props.environment.now)

  const [address, setAddress] = createSignal(props.environment.durable.getItem(ADDRESS) ?? '')
  const [standing, setStanding] = createSignal<Standing>('idle')
  const [capability, setCapability] = createSignal<ServerCapability | undefined>()
  const [configuration, setConfiguration] = createSignal<SmartConfiguration | undefined>()
  const [client, setClient] = createSignal<Client | undefined>()
  const [catalogue, setCatalogue] = createSignal<Catalogue | undefined>()
  const [signedIn, setSignedIn] = createSignal(false)

  function build(base: string): Client {
    return createClient({
      base,
      http: cachingHttp(props.environment.http, createStore()),
      token: () => held.token()
    })
  }

  async function ask(base: string): Promise<void> {
    const made = build(base)
    const described = createCatalogue(made)

    batch(() => {
      setClient(() => made)
      setCatalogue(() => described)
    })

    const answered = await described.capability()

    if (!answered.ok) {
      setStanding(answered.error.kind === 'transport' ? 'unreachable' : 'reachable')
      troubles.report(base, answered.error.message)
      return
    }

    setCapability(answered.value)
    setStanding('reachable')
  }

  const connection: Connection = {
    address,
    standing,
    capability,
    configuration,
    client,
    catalogue,
    signedIn,
    expired: () => held.expired(),

    connect: async (wanted) => {
      const base = wanted.replace(/\/+$/, '')

      setAddress(base)
      props.environment.durable.setItem(ADDRESS, base)
      setStanding('asking')
      setCapability(undefined)
      setConfiguration(undefined)

      const found = await discover(base, props.environment.http)

      if (!found.ok) {
        setStanding(found.error.kind === 'unreachable' ? 'unreachable' : 'unsupported')
        troubles.report(base, found.error.message)
        return
      }

      setConfiguration(found.value)

      await ask(base)
    },

    signIn: async (returnTo) => {
      const found = configuration()

      if (found === undefined) {
        troubles.report(address(), 'this server has not said how a session is obtained')
        return
      }

      const begun = await beginLaunch(found, {
        server: address(),
        clientId: CLIENT_ID,
        redirect: redirectOf(props.environment),
        scopes: ['openid', 'profile', 'fhirUser', 'patient/*.read', 'user/*.*'],
        returnTo
      })

      held.begin(begun.pending)
      props.environment.go(begun.url)
    },

    complete: async (params) => {
      const pending: Pending | undefined = held.pending()

      if (pending === undefined) {
        return undefined
      }

      const obtained = await completeLaunch(params, pending, props.environment.http, props.environment.now)

      if (!obtained.ok) {
        troubles.report(pending.server, obtained.error.message)
        return pending.returnTo
      }

      const session: Session = obtained.value

      held.hold(session)
      setSignedIn(true)

      if (client() === undefined || address() !== pending.server) {
        setAddress(pending.server)
        await ask(pending.server)
      }

      return pending.returnTo
    },

    signOut: () => {
      held.clear()
      setSignedIn(false)
    }
  }

  return <ConnectionContext.Provider value={connection}>{props.children}</ConnectionContext.Provider>
}

export function useConnection(): Connection {
  const connection = useContext(ConnectionContext)

  if (connection === undefined) {
    throw new Error('no server connection is in scope')
  }

  return connection
}

export { capabilityOf }
