import { describe, expect, it } from 'vitest'
import { challengeOf, createVerifier, randomState } from './pkce'

describe('proof key', () => {
  it('makes a verifier of the length the exchange asks for', () => {
    const verifier = createVerifier()

    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/)
  })

  it('makes a different verifier each time', () => {
    expect(createVerifier()).not.toBe(createVerifier())
  })

  it('derives a challenge the issuer can check', async () => {
    const challenge = await challengeOf('a'.repeat(43))

    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/)
    expect(challenge).not.toContain('=')
    expect(await challengeOf('a'.repeat(43))).toBe(challenge)
  })

  it('derives a different challenge from a different verifier', async () => {
    expect(await challengeOf('a'.repeat(43))).not.toBe(await challengeOf('b'.repeat(43)))
  })

  it('makes a state no answer can guess', () => {
    expect(randomState()).not.toBe(randomState())
    expect(randomState()).toMatch(/^[A-Za-z0-9\-_]+$/)
  })
})
