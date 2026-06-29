import { beforeAll, describe, expect, it } from 'vitest'
import { loginThrough } from '../tools/harness/login.mjs'
import { beginLaunch, completeLaunch } from '@lib/auth'
import { createSession, memoryPending } from '@lib/auth'
import { discover } from '@lib/auth'
import { capabilityOf, searchParamsOf, supports } from '@lib/conformance'
import { createCatalogue } from '@lib/conformance'
import { referencesOf } from '@lib/conformance'
import { createClient } from '@lib/transport'
import { cachingHttp, createStore } from '@lib/transport'
import { httpOverFetch } from '@lib/transport'
import { entriesOf, linkOf } from '@lib/transport'
import type { Pending, Session } from '@lib/auth'
import type { Client } from '@lib/transport'

const base = (): string => {
  const address = process.env.EXPLORER_LIVE_BASE

  if (address === undefined) {
    throw new Error('the harness announced no address')
  }

  return address
}

const http = httpOverFetch()
const redirect = 'http://127.0.0.1:9999/launch'

async function session(): Promise<Session> {
  const found = await discover(base(), http)

  if (!found.ok) {
    throw new Error(found.error.message)
  }

  const begun = await beginLaunch(found.value, {
    server: base(),
    clientId: process.env.EXPLORER_LIVE_CLIENT ?? 'explorer',
    redirect,
    scopes: ['openid', 'profile'],
    returnTo: '#/'
  })

  const params = await loginThrough(
    begun.url,
    process.env.EXPLORER_LIVE_USER ?? '',
    process.env.EXPLORER_LIVE_PASSWORD ?? ''
  )
  launched = begun.pending
  const obtained = await completeLaunch(params, begun.pending, http, () => Date.now())

  if (!obtained.ok) {
    throw new Error(obtained.error.message)
  }

  return obtained.value
}

let held: Session
let client: Client
let launched: Pending

beforeAll(async () => {
  held = await session()
  client = createClient({ base: base(), http: cachingHttp(http, createStore()), token: () => held.accessToken })
})

describe('a live server', () => {
  it('advertises where a session is obtained', async () => {
    const found = await discover(base(), http)

    expect(found.ok).toBe(true)
    if (!found.ok) return
    expect(found.value.authorize).toContain('http')
    expect(found.value.token).toContain('http')
  })

  it('grants a session to a launch that proves its key', () => {
    expect(held.accessToken.length).toBeGreaterThan(0)
    expect(held.expiresAt).toBeGreaterThan(Date.now())
  })

  it('refuses a request carrying no session', async () => {
    const open = createClient({ base: base(), http })

    const result = await open.read('Patient', 'patient-0')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.status).toBe(401)
    expect(result.error.issues.length).toBeGreaterThan(0)
  })

  it('answers what it can do', async () => {
    const answer = await client.fetch({ method: 'GET', url: `${base()}/metadata` })

    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    const capability = capabilityOf(answer.value.resource)
    expect(capability.fhirVersion).toBeTruthy()
    expect(supports(capability, 'Patient', 'read')).toBe(true)
    expect(searchParamsOf(capability, 'Patient').map((param) => param.name)).toContain('name')
  })

  it('reads a resource that was seeded into it', async () => {
    const result = await client.read('Patient', 'patient-0')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.resource.id).toBe('patient-0')
    expect(result.value.versionId).toBeTruthy()
  })

  it('says plainly that a resource is not there', async () => {
    const result = await client.read('Patient', 'nothing-here')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.status).toBe(404)
  })

  it('searches by a parameter it declares', async () => {
    const result = await client.search('Patient', [['name', 'Ada']])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(entriesOf(result.value.resource).length).toBeGreaterThan(0)
  })

  it('walks a set by the links it carries', async () => {
    const first = await client.search('Patient', [['_count', '1']])

    expect(first.ok).toBe(true)
    if (!first.ok) return
    const next = linkOf(first.value.resource, 'next')
    expect(next).toBeTruthy()

    const second = await client.follow(next ?? '')
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(entriesOf(second.value.resource)[0]?.id).not.toBe(entriesOf(first.value.resource)[0]?.id)
  })

  it('describes a type it serves, or says it cannot', async () => {
    const catalogue = createCatalogue(client)

    const described = await catalogue.definition('Observation')

    expect(described.ok).toBe(true)
    if (!described.ok) return

    if (described.value.complete) {
      expect(referencesOf(described.value).map((element) => element.path)).toContain('Observation.subject')
      expect(catalogue.undescribed()).not.toContain('Observation')
    } else {
      expect(described.value.elements).toHaveLength(0)
      expect(catalogue.undescribed()).toContain('Observation')
    }
  })

  it('names the reference a seeded resource carries', async () => {
    const result = await client.read('Observation', 'observation-0')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.stringify(result.value.resource)).toContain('Patient/patient-0')
  })

  it('writes and reads back what it was given', async () => {
    const created = await client.create({ resourceType: 'Patient', name: [{ family: 'Written' }] })

    expect(created.ok).toBe(true)
    if (!created.ok) return
    const id = created.value.resource.id ?? ''
    expect(id.length).toBeGreaterThan(0)

    const updated = await client.update(
      { resourceType: 'Patient', id, name: [{ family: 'Rewritten' }] },
      created.value.versionId === undefined ? undefined : { versionId: created.value.versionId }
    )
    expect(updated.ok).toBe(true)

    const history = await client.history('Patient', id)
    expect(history.ok).toBe(true)
    if (!history.ok) return
    expect(entriesOf(history.value.resource).length).toBeGreaterThan(1)

    const removed = await client.remove('Patient', id)
    expect(removed.ok).toBe(true)
  })

  it('asks again with the tag it was given', async () => {
    const store = createStore()
    const tagged = createClient({
      base: base(),
      http: cachingHttp(http, store),
      token: () => held.accessToken
    })

    const first = await tagged.read('Patient', 'patient-1')
    const second = await tagged.read('Patient', 'patient-1')

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.value.versionId).toBe(first.value.versionId)
  })

  it('renews a session the issuer is willing to renew', async () => {
    expect(held.refreshToken).toBeTruthy()

    const store = memoryPending()
    const holder = createSession(store, () => Date.now())
    holder.begin(launched)
    holder.hold(held)

    const renewed = await holder.renew(http)

    expect(renewed.ok).toBe(true)
    expect(holder.token()).toBeTruthy()
    expect(holder.token()).not.toBe(held.accessToken)
  })
})
