import { describe, expect, it } from 'vitest'
import { columnsOf, factsOf, saidAt } from './summary'

const patient = {
  resourceType: 'Patient',
  id: 'p1',
  meta: { versionId: '1' },
  active: true,
  name: [{ family: 'Lovelace', given: ['Ada'] }],
  gender: 'female',
  birthDate: '1979-12-10',
  managingOrganization: { reference: 'Organization/o1', display: 'A clinic' }
}

const observation = {
  resourceType: 'Observation',
  id: 'o1',
  status: 'final',
  code: { coding: [{ code: '29463-7', display: 'Body weight' }] },
  subject: { reference: 'Patient/p1', display: 'Ada Lovelace' },
  valueQuantity: { value: 72, unit: 'kg' },
  effectivePeriod: { start: '2026-01-01' }
}

describe('the facts a resource carries', () => {
  it('leaves out what belongs to the server rather than the reader', () => {
    expect(factsOf(patient).map((fact) => fact.name)).not.toContain('meta')
    expect(factsOf(patient).map((fact) => fact.name)).not.toContain('id')
  })

  it('says a flag, a word and a date as they are', () => {
    const said = Object.fromEntries(factsOf(patient).map((fact) => [fact.name, fact.said]))

    expect(said).toMatchObject({ active: 'true', gender: 'female', birthDate: '1979-12-10' })
  })

  it('says a code by what it displays and a quantity with its unit', () => {
    const said = Object.fromEntries(factsOf(observation).map((fact) => [fact.name, fact.said]))

    expect(said.code).toBe('Body weight')
    expect(said.valueQuantity).toBe('72 kg')
  })

  it('says a reference by what it displays, and a period by when it started', () => {
    const said = Object.fromEntries(factsOf(observation).map((fact) => [fact.name, fact.said]))

    expect(said.subject).toBe('Ada Lovelace')
    expect(said.effectivePeriod).toBe('2026-01-01')
  })

  it('looks into a list for the first thing it can say', () => {
    expect(saidAt(patient, 'name')).toBe('Ada Lovelace')
  })

  it('says nothing about an element it cannot put in a line', () => {
    expect(saidAt({ resourceType: 'Thing', nested: { deeper: { deeper: {} } } }, 'nested')).toBe('')
  })

  it('stops at the number of facts it was asked for', () => {
    expect(factsOf(patient, 2)).toHaveLength(2)
  })
})

describe('the columns a set of results deserves', () => {
  it('takes what most of the resources carry', () => {
    const columns = columnsOf([
      { resourceType: 'Patient', gender: 'female', birthDate: '1979-12-10' },
      { resourceType: 'Patient', gender: 'male', birthDate: '1982-06-23' },
      { resourceType: 'Patient', gender: 'male' }
    ])

    expect(columns).toContain('gender')
    expect(columns).toContain('birthDate')
  })

  it('leaves out what only one of them carries', () => {
    const columns = columnsOf([
      { resourceType: 'Patient', gender: 'female' },
      { resourceType: 'Patient', gender: 'male' },
      { resourceType: 'Patient', gender: 'male', deceasedBoolean: true }
    ])

    expect(columns).not.toContain('deceasedBoolean')
  })

  it('takes no more than it was asked for', () => {
    expect(columnsOf([observation, observation], 2)).toHaveLength(2)
  })

  it('has nothing to say about nothing', () => {
    expect(columnsOf([])).toHaveLength(0)
  })
})

describe('a column that would say what the first one says', () => {
  it('is left out', () => {
    const columns = columnsOf([
      { resourceType: 'Patient', name: [{ family: 'Lovelace' }], gender: 'female' },
      { resourceType: 'Patient', name: [{ family: 'Hopper' }], gender: 'female' }
    ])

    expect(columns).not.toContain('name')
    expect(columns).toContain('gender')
  })

  it('leaves the others alone where the first column is the identity', () => {
    const columns = columnsOf([
      { resourceType: 'Thing', id: 'a', size: 'large' },
      { resourceType: 'Thing', id: 'b', size: 'small' }
    ])

    expect(columns).toContain('size')
  })
})

describe('a reference with nothing to call it by', () => {
  it('is shortened rather than shown whole', () => {
    const said = saidAt(
      { resourceType: 'Observation', performer: [{ reference: 'Practitioner/0b3a9f16-88f4-4f0a-9f9b-6b2b0a3f0c1d' }] },
      'performer'
    )

    expect(said).toBe('Practitioner/0b3a9f16…')
  })

  it('is called by its name wherever the server gave one', () => {
    expect(saidAt({ resourceType: 'Observation', subject: { reference: 'Patient/1', display: 'Ada' } }, 'subject')).toBe(
      'Ada'
    )
  })
})

describe('a value that was measured', () => {
  it('keeps its number when the quantity also carries a code', () => {
    const observation = {
      resourceType: 'Observation',
      id: 'o1',
      valueQuantity: { value: 70.5, unit: 'kg', system: 'http://unitsofmeasure.org', code: 'kg' }
    }

    expect(saidAt(observation, 'valueQuantity')).toBe('70.5 kg')
  })

  it('says the number alone where no unit was given', () => {
    expect(saidAt({ resourceType: 'Observation', id: 'o1', valueQuantity: { value: 2 } }, 'valueQuantity')).toBe('2')
  })

  it('still reads a coded concept as a code', () => {
    const observation = {
      resourceType: 'Observation',
      id: 'o1',
      code: { coding: [{ code: '29463-7', display: 'Body weight' }] }
    }

    expect(saidAt(observation, 'code')).toBe('Body weight')
  })
})

