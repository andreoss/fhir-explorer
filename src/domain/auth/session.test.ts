import { describe, expect, it } from 'vitest'
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
