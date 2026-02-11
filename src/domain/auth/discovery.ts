import { record, strings, text } from '../fhir/json'
import type { Json } from '../fhir/types'
import type { Http } from '../transport/port'

export type SmartConfiguration = {
  readonly authorize: string
  readonly token: string
  readonly scopes: readonly string[]
  readonly capabilities: readonly string[]
  readonly revoke?: string
  readonly introspect?: string
}

export type DiscoveryFailureKind = 'unreachable' | 'unsupported'

export type DiscoveryFailure = {
  readonly kind: DiscoveryFailureKind
  readonly message: string
}

export type Discovered =
  | { readonly ok: true; readonly value: SmartConfiguration }
  | { readonly ok: false; readonly error: DiscoveryFailure }

function parse(body: string): Readonly<Record<string, Json | undefined>> | undefined {
  try {
    return record(JSON.parse(body) as Json)
  } catch {
    return undefined
  }
}

export async function discover(base: string, http: Http, signal?: AbortSignal): Promise<Discovered> {
  const url = `${base.replace(/\/+$/, '')}/.well-known/smart-configuration`
  let answer

  try {
    answer = await http({
      method: 'GET',
      url,
      headers: { accept: 'application/json' },
      ...(signal === undefined ? {} : { signal })
    })
  } catch (cause) {
    return {
      ok: false,
      error: { kind: 'unreachable', message: cause instanceof Error ? cause.message : String(cause) }
    }
  }

  if (answer.status >= 400) {
    return {
      ok: false,
      error: {
        kind: 'unsupported',
        message: `this server answered ${String(answer.status)} for its discovery document and cannot be explored`
      }
    }
  }

  const document = parse(answer.body)
  const authorize = text(document?.authorization_endpoint)
  const token = text(document?.token_endpoint)

  if (authorize === undefined || token === undefined) {
    return {
      ok: false,
      error: {
        kind: 'unsupported',
        message: 'this server names no place to obtain a session in its discovery document'
      }
    }
  }

  const revoke = text(document?.revocation_endpoint)
  const introspect = text(document?.introspection_endpoint)

  return {
    ok: true,
    value: {
      authorize,
      token,
      scopes: strings(document?.scopes_supported),
      capabilities: strings(document?.capabilities),
      ...(revoke === undefined ? {} : { revoke }),
      ...(introspect === undefined ? {} : { introspect })
    }
  }
}
