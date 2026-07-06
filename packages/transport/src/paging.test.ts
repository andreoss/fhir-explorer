import { describe, expect, it } from 'vitest'
import type { Bundle } from '@lib/fhir'
import { entriesOf, followed, linkOf, totalOf } from './paging'

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

describe('a link a server gives for the next page', () => {
  it('is followed as it stands when the server answers where the reader is looking', () => {
    expect(followed('https://example.org/fhir', 'https://example.org/fhir/Patient?_page=2')).toBe(
      'https://example.org/fhir/Patient?_page=2'
    )
  })

  it('is followed on the origin the reader reached the server through', () => {
    expect(followed('http://127.0.0.1:8123', 'http://10.0.0.4:8080/fhir/Patient?_count=20&_page=2')).toBe(
      'http://127.0.0.1:8123/Patient?_count=20&_page=2'
    )
  })

  it('keeps the whole path a resource sits at', () => {
    expect(followed('https://gate.example/api', 'http://inside:8080/fhir/Patient/p1/_history?_page=3')).toBe(
      'https://gate.example/api/Patient/p1/_history?_page=3'
    )
  })

  it('takes a relative link against the base it was given', () => {
    expect(followed('https://example.org/fhir', 'Patient?_page=4')).toBe('https://example.org/fhir/Patient?_page=4')
  })

  it('keeps what it cannot place, rather than guessing a path', () => {
    expect(followed('https://gate.example/api', 'http://inside:8080/fhir?_page=2')).toBe(
      'https://gate.example/api?_page=2'
    )
  })
})
