import { describe, expect, it } from 'vitest'
import { readable, shortId } from './readable'

describe('an element said the way a reader would say it', () => {
  it('puts a space where the spelling runs words together', () => {
    expect(readable('birthDate')).toBe('Birth date')
    expect(readable('managingOrganization')).toBe('Managing organization')
    expect(readable('generalPractitioner')).toBe('General practitioner')
  })

  it('leaves a single word alone but for its first letter', () => {
    expect(readable('gender')).toBe('Gender')
    expect(readable('status')).toBe('Status')
  })

  it('drops the mark a choice of types carries', () => {
    expect(readable('value[x]')).toBe('Value')
    expect(readable('effectiveDateTime')).toBe('Effective date time')
  })

  it('says only the last part of a path', () => {
    expect(readable('Observation.component.code')).toBe('Code')
  })

  it('keeps an initialism together', () => {
    expect(readable('URLTemplate')).toBe('Url template')
  })

  it('separates a number from the word before it', () => {
    expect(readable('line1')).toBe('Line 1')
  })

  it('has nothing to say about nothing', () => {
    expect(readable('')).toBe('')
  })
})

describe('an address shown where there is no name', () => {
  it('shortens an identity nobody reads', () => {
    expect(shortId('Patient/0b3a9f16-88f4-4f0a-9f9b-6b2b0a3f0c1d')).toBe('Patient/0b3a9f16…')
  })

  it('leaves a short identity whole', () => {
    expect(shortId('Patient/p1')).toBe('Patient/p1')
  })

  it('leaves anything that is not an address alone', () => {
    expect(shortId('nonsense')).toBe('nonsense')
  })
})
