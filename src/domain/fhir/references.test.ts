import { describe, expect, it } from 'vitest'
import { pointingFrom, versionedOf } from './references'

describe('what a resource points at', () => {
  it('finds a reference wherever it is written', () => {
    const found = pointingFrom({
      resourceType: 'Observation',
      subject: { reference: 'Patient/1' },
      performer: [{ reference: 'Practitioner/2', display: 'A doctor' }]
    })

    expect(found).toHaveLength(2)
    expect(found[0]).toMatchObject({ path: 'subject', type: 'Patient', id: '1' })
    expect(found[1]).toMatchObject({ path: 'performer[0]', type: 'Practitioner', id: '2', display: 'A doctor' })
  })

  it('finds a reference nested under a backbone element', () => {
    const found = pointingFrom({
      resourceType: 'Encounter',
      participant: [{ individual: { reference: 'Practitioner/3' } }]
    })

    expect(found[0]?.path).toBe('participant[0].individual')
  })

  it('takes the type a reference declares over the one in its address', () => {
    const found = pointingFrom({ resourceType: 'Thing', at: { reference: 'urn:uuid:1', type: 'Patient' } })

    expect(found[0]?.type).toBe('Patient')
  })

  it('ignores a reference into the resource itself', () => {
    expect(pointingFrom({ resourceType: 'Thing', at: { reference: '#contained' } })).toHaveLength(0)
  })

  it('ignores an address it cannot make a type and an identity out of', () => {
    expect(pointingFrom({ resourceType: 'Thing', at: { reference: 'nonsense' } })).toHaveLength(0)
    expect(pointingFrom({ resourceType: 'Thing', at: { display: 'only a name' } })).toHaveLength(0)
  })

  it('ignores where the resource itself lives', () => {
    expect(pointingFrom({ resourceType: 'Thing', id: '1', meta: { versionId: '2' } })).toHaveLength(0)
  })

  it('reads a versioned address as the resource it names', () => {
    expect(versionedOf('Patient/1/_history/3')).toBe('Patient/1')
    expect(versionedOf('Patient/1')).toBe('Patient/1')
  })

  it('walks past values that hold nothing to point at', () => {
    expect(pointingFrom({ resourceType: 'Thing', count: 3, flag: true, nothing: null, words: ['a'] })).toHaveLength(0)
  })
})
