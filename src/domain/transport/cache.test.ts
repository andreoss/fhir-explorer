import { describe, expect, it } from 'vitest'
import { empty, json, stubHttp } from '../../test/http'
import { cachingHttp, createStore } from './cache'

const url = 'https://example.org/fhir/Patient/1'

describe('cache', () => {
  it('asks again with the tag it was given', async () => {
    const stub = stubHttp([
      json(200, { resourceType: 'Patient', id: '1' }, { etag: 'W/"3"' }),
      empty(304, { etag: 'W/"3"' })
    ])
    const http = cachingHttp(stub.http, createStore())

    await http({ method: 'GET', url, headers: {} })
    const again = await http({ method: 'GET', url, headers: {} })

    expect(stub.requests[1]?.headers['if-none-match']).toBe('W/"3"')
    expect(again.status).toBe(200)
    expect(again.body).toContain('Patient')
  })

  it('takes a fresh answer over the one it kept', async () => {
    const stub = stubHttp([
      json(200, { resourceType: 'Patient', id: '1', meta: { versionId: '3' } }, { etag: 'W/"3"' }),
      json(200, { resourceType: 'Patient', id: '1', meta: { versionId: '4' } }, { etag: 'W/"4"' })
    ])
    const http = cachingHttp(stub.http, createStore())

    await http({ method: 'GET', url, headers: {} })
    const again = await http({ method: 'GET', url, headers: {} })

    expect(again.body).toContain('"4"')
  })

  it('forgets what a write may have changed', async () => {
    const stub = stubHttp([
      json(200, { resourceType: 'Patient', id: '1' }, { etag: 'W/"3"' }),
      json(200, { resourceType: 'Patient', id: '1' }, { etag: 'W/"4"' }),
      json(200, { resourceType: 'Patient', id: '1' }, { etag: 'W/"4"' })
    ])
    const http = cachingHttp(stub.http, createStore())

    await http({ method: 'GET', url, headers: {} })
    await http({ method: 'PUT', url, headers: {}, body: '{}' })
    await http({ method: 'GET', url, headers: {} })

    expect(stub.requests[2]?.headers['if-none-match']).toBeUndefined()
  })

  it('keeps nothing an answer did not tag', async () => {
    const stub = stubHttp([
      json(200, { resourceType: 'Patient', id: '1' }),
      json(200, { resourceType: 'Patient', id: '1' })
    ])
    const http = cachingHttp(stub.http, createStore())

    await http({ method: 'GET', url, headers: {} })
    await http({ method: 'GET', url, headers: {} })

    expect(stub.requests[1]?.headers['if-none-match']).toBeUndefined()
  })

  it('answers a request the caller already tagged without inventing one', async () => {
    const stub = stubHttp([empty(304)])
    const http = cachingHttp(stub.http, createStore())

    const answer = await http({ method: 'GET', url, headers: { 'if-none-match': 'W/"9"' } })

    expect(answer.status).toBe(304)
  })
})

describe('outcome parsing', () => {
  it('keeps nothing from a body that parses but is not a resource', async () => {
    const stub = stubHttp([{ status: 200, headers: { etag: 'W/"1"' }, body: '[]' }])
    const http = cachingHttp(stub.http, createStore())

    const answer = await http({ method: 'GET', url, headers: {} })

    expect(answer.status).toBe(200)
  })
})
