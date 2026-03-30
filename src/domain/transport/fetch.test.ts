import { describe, expect, it, vi } from 'vitest'
import { httpOverFetch } from './fetch'

describe('fetch adapter', () => {
  it('sends what it was asked to send', async () => {
    const answer = new Response('{}', { status: 200, headers: { ETag: 'W/"1"' } })
    const spy = vi.fn<typeof fetch>().mockResolvedValue(answer)
    const http = httpOverFetch(spy)
    const control = new AbortController()

    const result = await http({
      method: 'PUT',
      url: 'https://example.org/fhir/Patient/1',
      headers: { accept: 'application/fhir+json' },
      body: '{}',
      signal: control.signal
    })

    const call = spy.mock.calls[0]
    expect(call?.[0]).toBe('https://example.org/fhir/Patient/1')
    expect(call?.[1]?.method).toBe('PUT')
    expect(call?.[1]?.body).toBe('{}')
    expect(call?.[1]?.signal).toBe(control.signal)
    expect(result.status).toBe(200)
    expect(result.headers.etag).toBe('W/"1"')
  })

  it('reads a body the server sent without one being asked for', async () => {
    const spy = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    const http = httpOverFetch(spy)

    const result = await http({ method: 'DELETE', url: 'https://example.org/fhir/Patient/1', headers: {} })

    expect(result.status).toBe(204)
    expect(result.body).toBe('')
  })
})

describe('what a read is allowed to come from', () => {
  it('asks for no copy the browser kept of an earlier answer', async () => {
    const spy = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }))
    const http = httpOverFetch(spy)

    await http({ method: 'GET', url: 'https://example.org/fhir/Patient/1', headers: {} })

    expect(spy.mock.calls[0]?.[1]?.cache).toBe('no-store')
  })
})
