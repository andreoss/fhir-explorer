import { describe, expect, it } from 'vitest'
import type { Bundle } from '@lib/fhir'
import { entriesOf, linkOf, totalOf } from './paging'

const bundle: Bundle = {
  resourceType: 'Bundle',
  total: 42,
  link: [
    { relation: 'self', url: 'https://example.org/fhir/Patient?_count=2' },
    { relation: 'next', url: 'https://example.org/fhir/Patient?page=2' }
  ],
  entry: [{ resource: { resourceType: 'Patient', id: '1' } }, { fullUrl: 'urn:uuid:2' }]
}

describe('paging', () => {
  it('reads a link the server declared', () => {
    expect(linkOf(bundle, 'next')).toBe('https://example.org/fhir/Patient?page=2')
  })

  it('has no link the server did not declare', () => {
    expect(linkOf(bundle, 'previous')).toBeUndefined()
    expect(linkOf({ resourceType: 'Bundle' }, 'next')).toBeUndefined()
  })

  it('takes the resources a set carries', () => {
    expect(entriesOf(bundle)).toHaveLength(1)
    expect(entriesOf({ resourceType: 'Bundle' })).toHaveLength(0)
  })

  it('reports a total only when the server counted', () => {
    expect(totalOf(bundle)).toBe(42)
    expect(totalOf({ resourceType: 'Bundle' })).toBeUndefined()
  })
})
