import { record, text } from '../fhir'
import type { Json } from '../fhir'
import type { Http } from '../transport'
import type { SmartConfiguration } from './discovery'
import { challengeOf, createVerifier, randomState } from './pkce'

export type LaunchRequest = {
  readonly server: string
  readonly clientId: string
  readonly redirect: string
  readonly scopes: readonly string[]
  readonly returnTo: string
}

export type Pending = {
  readonly state: string
  readonly verifier: string
  readonly server: string
  readonly clientId: string
  readonly redirect: string
  readonly token: string
  readonly returnTo: string
}

export type Session = {
  readonly accessToken: string
  readonly expiresAt: number
  readonly scope: string
  readonly context: Readonly<Record<string, string>>
  readonly refreshToken?: string
}

export type SessionFailureKind = 'state' | 'refused' | 'unreachable' | 'unreadable'

export type SessionFailure = {
  readonly kind: SessionFailureKind
  readonly message: string
}

export type Obtained =
  | { readonly ok: true; readonly value: Session }
  | { readonly ok: false; readonly error: SessionFailure }

export type Clock = () => number

const CONTEXT = ['patient', 'encounter', 'fhirUser', 'id_token', 'need_patient_banner', 'intent', 'smart_style_url']

function offered(configuration: SmartConfiguration): readonly string[] {
  return configuration.scopes.flatMap((scope) => scope.split(/\s+/).filter((one) => one.length > 0))
}

function asked(configuration: SmartConfiguration, wanted: readonly string[]): readonly string[] {
  const available = offered(configuration)

  if (available.length === 0) {
    return wanted
  }

  const shared = wanted.filter((scope) => available.includes(scope))

  return shared.length > 0 ? shared : wanted
}

export async function beginLaunch(
  configuration: SmartConfiguration,
  request: LaunchRequest
): Promise<{ readonly url: string; readonly pending: Pending }> {
  const verifier = createVerifier()
  const state = randomState()
  const challenge = await challengeOf(verifier)
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: request.clientId,
    redirect_uri: request.redirect,
    scope: asked(configuration, request.scopes).join(' '),
    state,
    aud: request.server,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  })

  return {
    url: `${configuration.authorize}?${query.toString()}`,
    pending: {
      state,
      verifier,
      server: request.server,
      clientId: request.clientId,
      redirect: request.redirect,
      token: configuration.token,
      returnTo: request.returnTo
    }
  }
}

function parse(body: string): Readonly<Record<string, Json | undefined>> | undefined {
  try {
    return record(JSON.parse(body) as Json)
  } catch {
    return undefined
  }
}

function contextOf(answer: Readonly<Record<string, Json | undefined>>): Readonly<Record<string, string>> {
  const carried: Record<string, string> = {}

  for (const name of CONTEXT) {
    const value = answer[name]

    if (typeof value === 'string') {
      carried[name] = value
    }
  }

  return carried
}

function sessionOf(answer: Readonly<Record<string, Json | undefined>>, now: Clock): Obtained {
  const accessToken = text(answer.access_token)

  if (accessToken === undefined) {
    return { ok: false, error: { kind: 'unreadable', message: 'the issuer answered without a token' } }
  }

  const expires = answer.expires_in
  const refreshToken = text(answer.refresh_token)

  return {
    ok: true,
    value: {
      accessToken,
      expiresAt: now() + (typeof expires === 'number' ? expires * 1000 : 0),
      scope: text(answer.scope) ?? '',
      context: contextOf(answer),
      ...(refreshToken === undefined ? {} : { refreshToken })
    }
  }
}

export async function exchange(
  token: string,
  form: URLSearchParams,
  http: Http,
  now: Clock
): Promise<Obtained> {
  let answer

  try {
    answer = await http({
      method: 'POST',
      url: token,
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: form.toString()
    })
  } catch (cause) {
    return {
      ok: false,
      error: { kind: 'unreachable', message: cause instanceof Error ? cause.message : String(cause) }
    }
  }

  const document = parse(answer.body)

  if (answer.status >= 400) {
    const reason = text(document?.error_description) ?? text(document?.error) ?? String(answer.status)

    return { ok: false, error: { kind: 'refused', message: reason } }
  }

  if (document === undefined) {
    return { ok: false, error: { kind: 'unreadable', message: 'the issuer answered something unreadable' } }
  }

  return sessionOf(document, now)
}

export async function completeLaunch(
  params: Readonly<Record<string, string>>,
  pending: Pending,
  http: Http,
  now: Clock
): Promise<Obtained> {
  if (params.state !== pending.state) {
    return { ok: false, error: { kind: 'state', message: 'this answer belongs to no launch made here' } }
  }

  const refused = params.error

  if (refused !== undefined) {
    return { ok: false, error: { kind: 'refused', message: params.error_description ?? refused } }
  }

  const code = params.code

  if (code === undefined) {
    return { ok: false, error: { kind: 'unreadable', message: 'the issuer answered without a code' } }
  }

  return exchange(
    pending.token,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirect,
      client_id: pending.clientId,
      code_verifier: pending.verifier
    }),
    http,
    now
  )
}

export async function refresh(session: Session, pending: Pending, http: Http, now: Clock): Promise<Obtained> {
  if (session.refreshToken === undefined) {
    return { ok: false, error: { kind: 'refused', message: 'this session cannot be renewed' } }
  }

  return exchange(
    pending.token,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
      client_id: pending.clientId
    }),
    http,
    now
  )
}
