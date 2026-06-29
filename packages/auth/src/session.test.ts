import { describe, expect, it } from 'vitest'
import { json, stubHttp } from '@lib/stub'
import type { Pending, Session } from './launch'
import { createSession, memoryPending, storedPending } from './session'

const pending: Pending = {
  state: 'state',
  verifier: 'v'.repeat(64),
  server: 'https://example.org/fhir',
  clientId: 'explorer',
  redirect: 'https://explorer.example.org/launch',
  token: 'https://issuer.example.org/token',
  returnTo: '#/type/Patient'
}

const session: Session = {
  accessToken: 'abc',
  expiresAt: 600_000,
  scope: 'patient/*.read',
  context: {},
  refreshToken: 'refresh'
}

describe('session', () => {
  it('carries no token before a launch has finished', () => {
    const held = createSession(memoryPending(), () => 0)

    expect(held.token()).toBeUndefined()
    expect(held.session()).toBeUndefined()
  })

  it('carries the token it was given', () => {
    const held = createSession(memoryPending(), () => 0)

    held.hold(session)

    expect(held.token()).toBe('abc')
    expect(held.session()?.scope).toBe('patient/*.read')
  })

  it('knows a session that is about to run out', () => {
    const held = createSession(memoryPending(), () => 590_000)

    held.hold(session)

    expect(held.expired()).toBe(true)
  })

  it('knows a session that still has time', () => {
    const held = createSession(memoryPending(), () => 100_000)

    held.hold(session)

    expect(held.expired()).toBe(false)
  })

  it('renews a session the issuer will renew', async () => {
    const held = createSession(memoryPending(), () => 700_000)
    held.begin(pending)
    held.hold(session)
    const stub = stubHttp([json(200, { access_token: 'new', expires_in: 300 })])

    const renewed = await held.renew(stub.http)

    expect(renewed.ok).toBe(true)
    expect(held.token()).toBe('new')
    expect(new URLSearchParams(stub.requests[0]?.body ?? '').get('grant_type')).toBe('refresh_token')
  })

  it('asks for a new launch when a renewal fails, keeping where it was', async () => {
    const held = createSession(memoryPending(), () => 700_000)
    held.begin(pending)
    held.hold(session)
    const stub = stubHttp([json(400, { error: 'invalid_grant' })])

    const renewed = await held.renew(stub.http)

    expect(renewed.ok).toBe(false)
    if (renewed.ok) return
    expect(renewed.relaunch).toBe(true)
    expect(renewed.returnTo).toBe('#/type/Patient')
    expect(held.token()).toBeUndefined()
  })

  it('cannot renew what it never launched', async () => {
    const held = createSession(memoryPending(), () => 0)
    held.hold(session)

    const renewed = await held.renew(stubHttp([]).http)

    expect(renewed.ok).toBe(false)
  })

  it('forgets everything when a session ends', () => {
    const held = createSession(memoryPending(), () => 0)
    held.begin(pending)
    held.hold(session)

    held.clear()

    expect(held.token()).toBeUndefined()
    expect(held.pending()).toBeUndefined()
  })

  it('keeps a launch across a redirect and no token with it', () => {
    const storage = new Map<string, string>()
    const store = storedPending({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    })
    const held = createSession(store, () => 0)

    held.begin(pending)
    held.hold(session)

    expect([...storage.values()].join()).toContain('state')
    expect([...storage.values()].join()).not.toContain('abc')
    expect(createSession(store, () => 0).pending()?.returnTo).toBe('#/type/Patient')
  })

  it('reads nothing from a store holding something else', () => {
    const storage = new Map<string, string>([['fhir-explorer.launch', 'broken']])
    const store = storedPending({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    })

    expect(createSession(store, () => 0).pending()).toBeUndefined()
  })
})
