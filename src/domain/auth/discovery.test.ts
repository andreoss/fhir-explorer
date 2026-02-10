import { describe, expect, it } from 'vitest'
import { json, stubHttp } from '../../test/http'
import { discover } from './discovery'

const base = 'https://example.org/fhir'

const document = {
  authorization_endpoint: 'https://issuer.example.org/authorize',
  token_endpoint: 'https://issuer.example.org/token',
  scopes_supported: ['openid', 'patient/*.read'],
  capabilities: ['launch-standalone', 'client-public']
}

describe('discovery', () => {
  it('reads where a session is obtained', async () => {
    const stub = stubHttp([json(200, document)])

    const result = await discover(base, stub.http)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.authorize).toBe('https://issuer.example.org/authorize')
    expect(result.value.token).toBe('https://issuer.example.org/token')
    expect(result.value.scopes).toEqual(['openid', 'patient/*.read'])
    expect(stub.requests[0]?.url).toBe(`${base}/.well-known/smart-configuration`)
  })



  it('refuses a document that is not a document', async () => {
    const stub = stubHttp([{ status: 200, headers: {}, body: 'nothing' }])

    const result = await discover(base, stub.http)

    expect(result.ok).toBe(false)
  })

  it('says a server could not be reached rather than that it refused', async () => {
    const stub = stubHttp([new Error('down')])

    const result = await discover(base, stub.http)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('unreachable')
  })

  it('carries what the issuer says it can do', async () => {
    const stub = stubHttp([json(200, document)])

    const result = await discover(base, stub.http)

    expect(result.ok && result.value.capabilities).toContain('launch-standalone')
  })
})
