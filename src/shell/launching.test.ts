import { describe, expect, it } from 'vitest'
import { answerOf, withoutAnswer } from './launching'

describe('a launch coming back', () => {
  it('is recognised by the code it carries', () => {
    const answer = answerOf(new URL('https://explorer.example.org/?code=a&state=b#/type/Patient'))

    expect(answer).toEqual({ code: 'a', state: 'b' })
  })

  it('is recognised by the refusal it carries', () => {
    expect(answerOf(new URL('https://explorer.example.org/?error=access_denied&state=b'))?.error).toBe(
      'access_denied'
    )
  })

  it('is not there when nothing came back', () => {
    expect(answerOf(new URL('https://explorer.example.org/#/'))).toBeUndefined()
  })

  it('leaves an address with nothing of the answer in it', () => {
    expect(withoutAnswer(new URL('https://explorer.example.org/?code=a&state=b#/type/Patient'))).toBe(
      'https://explorer.example.org/#/type/Patient'
    )
  })
})
