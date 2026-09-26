import { describe, expect, it } from 'vitest'
import { foremostOf, restOf } from './foremost'

const parameters = [
  '_id',
  '_lastUpdated',
  'active',
  'address',
  'address-city',
  'address-country',
  'birthdate',
  'death-date',
  'family',
  'gender',
  'general-practitioner',
  'given',
  'identifier',
  'name'
].map((name) => ({ name, type: 'string' }))

describe('the parameters a reader reaches for', () => {
  it('puts the plain ones before the compound ones', () => {
    const shown = foremostOf(parameters, 6).map((one) => one.name)

    expect(shown).toContain('name')
    expect(shown).toContain('family')
    expect(shown).not.toContain('address-city')
    expect(shown).not.toContain('general-practitioner')
  })

  it('leaves the ones a server owns until last', () => {
    expect(foremostOf(parameters, 6).map((one) => one.name)).not.toContain('_id')
  })

  it('keeps the rest, and only the rest', () => {
    const shown = foremostOf(parameters, 6)
    const rest = restOf(parameters, 6)

    expect(shown.length + rest.length).toBe(parameters.length)
    expect(rest.map((one) => one.name)).toContain('_id')
  })

  it('shows everything when there is little to show', () => {
    const few = [{ name: 'name', type: 'string' }]

    expect(foremostOf(few, 6)).toHaveLength(1)
    expect(restOf(few, 6)).toHaveLength(0)
  })
})

describe('the kind of a parameter, not only its spelling', () => {
  const mixed = [
    { name: 'link', type: 'reference' },
    { name: 'name', type: 'string' },
    { name: 'organization', type: 'reference' },
    { name: 'gender', type: 'token' },
    { name: 'death-date', type: 'date' }
  ]

  it('puts a field a reader fills before one that points into another record', () => {
    const first = foremostOf(mixed, 3).map((one) => one.name)

    expect(first).toEqual(['name', 'gender', 'death-date'])
    expect(first).not.toContain('link')
  })

  it('still leaves a reference among the rest', () => {
    expect(restOf(mixed, 3).map((one) => one.name)).toEqual(['link', 'organization'])
  })
})

