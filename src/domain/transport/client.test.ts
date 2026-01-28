import { describe, expect, it } from 'vitest'
import { empty, json, stubHttp } from '../../test/http'
import { createClient } from './client'

const base = 'https://example.org/fhir'

describe('client', () => {
  it('reads a resource and keeps its version and tag', async () => {
    const stub = stubHttp([
      json(200, { resourceType: 'Patient', id: '1' }, { etag: 'W/"3"', 'last-modified': 'Mon' })
    ])
    const client = createClient({ base, http: stub.http })

    const result = await client.read('Patient', '1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.resource.id).toBe('1')
    expect(result.value.versionId).toBe('3')
    expect(result.value.lastModified).toBe('Mon')
    expect(stub.requests[0]?.url).toBe(`${base}/Patient/1`)
    expect(stub.requests[0]?.headers.accept).toContain('fhir+json')
  })

  it('reads one version of a resource', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Patient', id: '1' })])
    const client = createClient({ base, http: stub.http })

    await client.vread('Patient', '1', '2')

    expect(stub.requests[0]?.url).toBe(`${base}/Patient/1/_history/2`)
  })

  it('turns a refusal into a failure carrying the server issues', async () => {
    const stub = stubHttp([
      json(404, {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found', diagnostics: 'gone' }]
      })
    ])
    const client = createClient({ base, http: stub.http })

    const result = await client.read('Patient', '1')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('status')
    expect(result.error.status).toBe(404)
    expect(result.error.issues[0]?.code).toBe('not-found')
    expect(result.error.message).toContain('gone')
  })

  it('never reports a body it could not read as a resource', async () => {
    const stub = stubHttp([{ status: 200, headers: {}, body: 'not json' }])
    const client = createClient({ base, http: stub.http })

    const result = await client.read('Patient', '1')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('payload')
  })

  it('reports a refused connection as a transport failure', async () => {
    const stub = stubHttp([new Error('refused')])
    const client = createClient({ base, http: stub.http })

    const result = await client.read('Patient', '1')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('transport')
    expect(result.error.message).toContain('refused')
  })

  it('searches with repeated parameters', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Bundle', type: 'searchset' })])
    const client = createClient({ base, http: stub.http })

    await client.search('Patient', [
      ['name', 'a'],
      ['name', 'b'],
      ['_count', '10']
    ])

    expect(stub.requests[0]?.url).toBe(`${base}/Patient?name=a&name=b&_count=10`)
  })

  it('creates a resource and reports where it went', async () => {
    const stub = stubHttp([
      json(
        201,
        { resourceType: 'Patient', id: '7' },
        { location: `${base}/Patient/7/_history/1`, etag: 'W/"1"' }
      )
    ])
    const client = createClient({ base, http: stub.http })

    const result = await client.create({ resourceType: 'Patient' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.location).toBe(`${base}/Patient/7/_history/1`)
    expect(stub.requests[0]?.method).toBe('POST')
    expect(stub.requests[0]?.url).toBe(`${base}/Patient`)
  })

  it('guards an update with the version it read', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Patient', id: '1' })])
    const client = createClient({ base, http: stub.http })

    await client.update({ resourceType: 'Patient', id: '1' }, { versionId: '3' })

    expect(stub.requests[0]?.method).toBe('PUT')
    expect(stub.requests[0]?.headers['if-match']).toBe('W/"3"')
  })

  it('deletes a resource', async () => {
    const stub = stubHttp([empty(204)])
    const client = createClient({ base, http: stub.http })

    const result = await client.remove('Patient', '1')

    expect(result.ok).toBe(true)
    expect(stub.requests[0]?.method).toBe('DELETE')
  })

  it('reads the history of a resource', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Bundle', type: 'history' })])
    const client = createClient({ base, http: stub.http })

    const result = await client.history('Patient', '1')

    expect(result.ok).toBe(true)
    expect(stub.requests[0]?.url).toBe(`${base}/Patient/1/_history`)
  })

  it('carries a cancellation signal to the transport', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Patient', id: '1' })])
    const client = createClient({ base, http: stub.http })
    const control = new AbortController()

    await client.read('Patient', '1', { signal: control.signal })

    expect(stub.requests[0]?.signal).toBe(control.signal)
  })

  it('reports an abandoned request as cancelled', async () => {
    const aborted = new Error('aborted')
    aborted.name = 'AbortError'
    const stub = stubHttp([aborted])
    const client = createClient({ base, http: stub.http })

    const result = await client.read('Patient', '1')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('cancelled')
  })

  it('follows a link the server gave rather than building one', async () => {
    const next = `${base}/Patient?_getpages=abc`
    const stub = stubHttp([json(200, { resourceType: 'Bundle' })])
    const client = createClient({ base, http: stub.http })

    await client.follow(next)

    expect(stub.requests[0]?.url).toBe(next)
  })
})

describe('client details', () => {
  it('carries a token when a session has one', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Patient', id: '1' })])
    const client = createClient({ base: `${base}/`, http: stub.http, token: () => 'abc' })

    await client.read('Patient', '1')

    expect(stub.requests[0]?.headers.authorization).toBe('Bearer abc')
    expect(stub.requests[0]?.url).toBe(`${base}/Patient/1`)
  })

  it('sends no token when a session has none', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Patient', id: '1' })])
    const client = createClient({ base, http: stub.http, token: () => undefined })

    await client.read('Patient', '1')

    expect(stub.requests[0]?.headers.authorization).toBeUndefined()
  })

  it('takes the version from the resource when no tag was sent', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Patient', id: '1', meta: { versionId: '9' } })])
    const client = createClient({ base, http: stub.http })

    const result = await client.read('Patient', '1')

    expect(result.ok && result.value.versionId).toBe('9')
  })

  it('takes the place a resource was moved to from either header', async () => {
    const stub = stubHttp([
      json(200, { resourceType: 'Patient', id: '1' }, { 'content-location': `${base}/Patient/1/_history/2` })
    ])
    const client = createClient({ base, http: stub.http })

    const result = await client.read('Patient', '1')

    expect(result.ok && result.value.location).toBe(`${base}/Patient/1/_history/2`)
  })

  it('reports an empty answer where a resource was owed', async () => {
    const stub = stubHttp([empty(200)])
    const client = createClient({ base, http: stub.http })

    const result = await client.read('Patient', '1')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('payload')
  })

  it('refuses a single resource where a set was asked for', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Patient', id: '1' })])
    const client = createClient({ base, http: stub.http })

    const result = await client.search('Patient', [])

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('payload')
    expect(stub.requests[0]?.url).toBe(`${base}/Patient`)
  })

  it('carries a failure through the set it was asked for', async () => {
    const stub = stubHttp([json(500, { resourceType: 'OperationOutcome' })])
    const client = createClient({ base, http: stub.http })

    const result = await client.search('Patient', [])

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.status).toBe(500)
    expect(result.error.message).toContain('500')
  })

  it('updates without a guard when nothing was read first', async () => {
    const stub = stubHttp([json(200, { resourceType: 'Patient', id: '1' })])
    const client = createClient({ base, http: stub.http })

    await client.update({ resourceType: 'Patient', id: '1' })

    expect(stub.requests[0]?.headers['if-match']).toBeUndefined()
    expect(stub.requests[0]?.headers['content-type']).toContain('fhir+json')
  })

  it('answers a deletion that returned an outcome', async () => {
    const stub = stubHttp([json(200, { resourceType: 'OperationOutcome' })])
    const client = createClient({ base, http: stub.http })

    const result = await client.remove('Patient', '1')

    expect(result.ok && result.value?.resource.resourceType).toBe('OperationOutcome')
  })

  it('makes a request the caller shaped', async () => {
    const stub = stubHttp([json(200, { resourceType: 'CapabilityStatement' })])
    const client = createClient({ base, http: stub.http })
    const control = new AbortController()

    const result = await client.fetch({
      method: 'GET',
      url: `${base}/metadata`,
      headers: { accept: 'application/json' },
      signal: control.signal
    })

    expect(result.ok && result.value.resource.resourceType).toBe('CapabilityStatement')
    expect(stub.requests[0]?.headers.accept).toBe('application/json')
    expect(stub.requests[0]?.signal).toBe(control.signal)
  })

  it('makes a request without a signal when none was given', async () => {
    const stub = stubHttp([json(200, { resourceType: 'CapabilityStatement' })])
    const client = createClient({ base, http: stub.http })

    await client.fetch({ method: 'GET', url: `${base}/metadata` })

    expect(stub.requests[0]?.signal).toBeUndefined()
  })
})
