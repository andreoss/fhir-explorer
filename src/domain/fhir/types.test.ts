import { describe, expect, it } from 'vitest'
import { fields, isBundle, isOutcome, isResource } from './types'

describe('types', () => {
  it('knows what came back as a resource', () => {
    expect(isResource({ resourceType: 'Patient' })).toBe(true)
    expect(isResource({ id: '1' })).toBe(false)
    expect(isResource(null)).toBe(false)
    expect(isResource([])).toBe(false)
    expect(isResource('Patient')).toBe(false)
    expect(isResource(undefined)).toBe(false)
  })

  it('knows a set from a single resource', () => {
    expect(isBundle({ resourceType: 'Bundle' })).toBe(true)
    expect(isBundle({ resourceType: 'Patient' })).toBe(false)
  })

  it('knows what the server said went wrong', () => {
    expect(isOutcome({ resourceType: 'OperationOutcome' })).toBe(true)
    expect(isOutcome({ resourceType: 'Patient' })).toBe(false)
  })

  it('reads elements the model does not name', () => {
    expect(fields({ resourceType: 'Patient', id: '1' }).id).toBe('1')
  })
})
