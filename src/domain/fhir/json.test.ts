import { describe, expect, it } from 'vitest'
import { count, list, record, scalar, strings, text } from './json'

describe('reading what a server sent', () => {
  it('takes an object as an object, and nothing else as one', () => {
    expect(record({ a: 1 })).toEqual({ a: 1 })
    expect(record([1])).toBeUndefined()
    expect(record('a')).toBeUndefined()
    expect(record(null)).toBeUndefined()
  })

  it('takes a list as a list, and anything else as an empty one', () => {
    expect(list([1, 2])).toEqual([1, 2])
    expect(list('a')).toEqual([])
    expect(list(undefined)).toEqual([])
  })

  it('takes text only where text was sent', () => {
    expect(text('a')).toBe('a')
    expect(text(3)).toBeUndefined()
  })
})

describe('a value read as one word', () => {
  it('says a string, a number and a flag as they are', () => {
    expect(scalar('final')).toBe('final')
    expect(scalar(3)).toBe('3')
    expect(scalar(true)).toBe('true')
    expect(scalar(false)).toBe('false')
  })

  it('says nothing of what is not one word', () => {
    expect(scalar({ value: 1 })).toBeUndefined()
    expect(scalar([1, 2])).toBeUndefined()
    expect(scalar(undefined)).toBeUndefined()
    expect(scalar(null)).toBeUndefined()
  })
})

describe('the rest of the reading', () => {
  it('keeps only the strings of a list', () => {
    expect(strings(['a', 1, 'b'])).toEqual(['a', 'b'])
  })

  it('counts only what was sent as a number', () => {
    expect(count(3)).toBe(3)
    expect(count('3')).toBe(0)
  })
})
