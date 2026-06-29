import { describe, expect, it } from 'vitest'
import { describeIssues, failed, issuesOf, ok, parseResource, statusFailure, transportFailure } from './outcome'

describe('outcome', () => {
  it('reads a resource out of a body', () => {
    expect(parseResource('{"resourceType":"Patient"}')?.resourceType).toBe('Patient')
  })

  it('reads nothing out of a body that is not a resource', () => {
    expect(parseResource('{"id":"1"}')).toBeUndefined()
    expect(parseResource('[]')).toBeUndefined()
    expect(parseResource('broken')).toBeUndefined()
  })

  it('finds issues only where the server raised them', () => {
    expect(issuesOf(undefined)).toHaveLength(0)
    expect(issuesOf({ resourceType: 'Patient' })).toHaveLength(0)
    expect(issuesOf({ resourceType: 'OperationOutcome' })).toHaveLength(0)
  })

  it('says what went wrong, or what the code was', () => {
    expect(describeIssues([{ severity: 'error', code: 'invalid' }], 'fallback')).toBe('invalid')
    expect(describeIssues([], 'fallback')).toBe('fallback')
  })

  it('describes a status the server sent without an outcome', () => {
    const failure = statusFailure(503, '')

    expect(failure.kind).toBe('status')
    expect(failure.message).toContain('503')
  })

  it('describes a failure that never reached the server', () => {
    expect(transportFailure('broken').message).toBe('broken')
    expect(transportFailure(new Error('down')).kind).toBe('transport')
  })

  it('wraps a value and a failure the same way', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 })
    expect(failed({ kind: 'payload', message: 'no', issues: [] }).ok).toBe(false)
  })
})

describe('a failure that was time running out', () => {
  it('is told apart from one that was abandoned and one that failed', () => {
    const late = new Error('the operation timed out')
    late.name = 'TimeoutError'
    const given = new Error('stopped')
    given.name = 'AbortError'

    expect(transportFailure(late).kind).toBe('timeout')
    expect(transportFailure(late).message).toContain('in time')
    expect(transportFailure(given).kind).toBe('cancelled')
    expect(transportFailure(new Error('refused')).kind).toBe('transport')
  })
})
