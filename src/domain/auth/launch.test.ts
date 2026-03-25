import { describe, expect, it } from 'vitest'
import { json, stubHttp } from '../../test/http'
import { beginLaunch, completeLaunch } from './launch'

const configuration = {
  authorize: 'https://issuer.example.org/authorize',
  token: 'https://issuer.example.org/token',
  scopes: ['openid', 'fhirUser', 'patient/*.read', 'offline_access'],
  capabilities: ['launch-standalone']
}

const request = {
  server: 'https://example.org/fhir',
  clientId: 'explorer',
  redirect: 'https://explorer.example.org/launch',
  scopes: ['openid', 'patient/*.read', 'user/*.*'],
  returnTo: '#/type/Patient'
}

describe('launch', () => {
  it('sends the asking party where the issuer said to', async () => {
    const begun = await beginLaunch(configuration, request)
    const url = new URL(begun.url)

    expect(`${url.origin}${url.pathname}`).toBe(configuration.authorize)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('explorer')
    expect(url.searchParams.get('redirect_uri')).toBe(request.redirect)
    expect(url.searchParams.get('aud')).toBe(request.server)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('state')).toBe(begun.pending.state)
  })



  it('asks only for what the issuer advertises', async () => {
    const begun = await beginLaunch(configuration, request)
    const asked = new URL(begun.url).searchParams.get('scope')?.split(' ')

    expect(asked).toEqual(['openid', 'patient/*.read'])
  })

  it('asks for what it was told to when the issuer advertises nothing', async () => {
    const begun = await beginLaunch({ ...configuration, scopes: [] }, request)

    expect(new URL(begun.url).searchParams.get('scope')).toBe('openid patient/*.read user/*.*')
  })

  it('keeps the place to return to with the launch it started', async () => {
    const begun = await beginLaunch(configuration, request)

    expect(begun.pending.returnTo).toBe('#/type/Patient')
    expect(begun.pending.verifier).toHaveLength(64)
  })

  it('exchanges a code for a session', async () => {
    const begun = await beginLaunch(configuration, request)
    const stub = stubHttp([
      json(200, {
        access_token: 'abc',
        token_type: 'Bearer',
        expires_in: 300,
        scope: 'patient/*.read',
        refresh_token: 'refresh',
        patient: '123'
      })
    ])

    const result = await completeLaunch(
      { code: 'code', state: begun.pending.state },
      begun.pending,
      stub.http,
      () => 1000
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.accessToken).toBe('abc')
    expect(result.value.expiresAt).toBe(1000 + 300 * 1000)
    expect(result.value.refreshToken).toBe('refresh')
    expect(result.value.context.patient).toBe('123')
    expect(stub.requests[0]?.url).toBe(configuration.token)
    expect(stub.requests[0]?.headers['content-type']).toBe('application/x-www-form-urlencoded')

    const sent = new URLSearchParams(stub.requests[0]?.body ?? '')
    expect(sent.get('grant_type')).toBe('authorization_code')
    expect(sent.get('code')).toBe('code')
    expect(sent.get('code_verifier')).toBe(begun.pending.verifier)
    expect(sent.get('redirect_uri')).toBe(request.redirect)
    expect(sent.get('client_id')).toBe('explorer')
  })

  it('refuses an answer that came back under another state', async () => {
    const begun = await beginLaunch(configuration, request)
    const stub = stubHttp([])

    const result = await completeLaunch({ code: 'code', state: 'other' }, begun.pending, stub.http, () => 0)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('state')
    expect(stub.requests).toHaveLength(0)
  })

  it('carries what the issuer refused', async () => {
    const begun = await beginLaunch(configuration, request)
    const stub = stubHttp([])

    const result = await completeLaunch(
      { error: 'access_denied', error_description: 'no', state: begun.pending.state },
      begun.pending,
      stub.http,
      () => 0
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('refused')
    expect(result.error.message).toContain('no')
  })

  it('refuses an answer carrying no code at all', async () => {
    const begun = await beginLaunch(configuration, request)

    const result = await completeLaunch({ state: begun.pending.state }, begun.pending, stubHttp([]).http, () => 0)

    expect(result.ok).toBe(false)
  })

  it('reports a token endpoint that refused', async () => {
    const begun = await beginLaunch(configuration, request)
    const stub = stubHttp([json(400, { error: 'invalid_grant' })])

    const result = await completeLaunch(
      { code: 'code', state: begun.pending.state },
      begun.pending,
      stub.http,
      () => 0
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('refused')
    expect(result.error.message).toContain('invalid_grant')
  })

  it('reports an issuer that could not be reached', async () => {
    const begun = await beginLaunch(configuration, request)
    const stub = stubHttp([new Error('down')])

    const result = await completeLaunch(
      { code: 'code', state: begun.pending.state },
      begun.pending,
      stub.http,
      () => 0
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('unreachable')
  })

  it('reports an answer that carried no token', async () => {
    const begun = await beginLaunch(configuration, request)
    const stub = stubHttp([json(200, { token_type: 'Bearer' })])

    const result = await completeLaunch(
      { code: 'code', state: begun.pending.state },
      begun.pending,
      stub.http,
      () => 0
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('unreadable')
  })

  it('takes a session without an expiry as one that must be asked about', async () => {
    const begun = await beginLaunch(configuration, request)
    const stub = stubHttp([json(200, { access_token: 'abc' })])

    const result = await completeLaunch(
      { code: 'code', state: begun.pending.state },
      begun.pending,
      stub.http,
      () => 500
    )

    expect(result.ok && result.value.expiresAt).toBe(500)
    expect(result.ok && result.value.refreshToken).toBeUndefined()
  })
})

describe('the scopes a launch asks for', () => {
  it('reads a list a server wrote as one string', async () => {
    const begun = await beginLaunch(
      { ...configuration, scopes: ['openid user/*.* patient/*.read'] },
      { ...request, scopes: ['openid', 'user/*.*', 'nothing/at.all'] }
    )

    expect(new URL(begun.url).searchParams.get('scope')?.split(' ')).toEqual(['openid', 'user/*.*'])
  })

  it('asks for what it wanted rather than for nothing', async () => {
    const begun = await beginLaunch(
      { ...configuration, scopes: ['something/else.read'] },
      { ...request, scopes: ['openid', 'patient/*.read'] }
    )

    expect(new URL(begun.url).searchParams.get('scope')).toBe('openid patient/*.read')
  })
})
