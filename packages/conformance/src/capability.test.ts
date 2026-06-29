import { describe, expect, it } from 'vitest'
import { capabilityOf, includesOf, searchParamsOf, supports, typeOf } from './capability'

const statement = {
  resourceType: 'CapabilityStatement',
  fhirVersion: '4.0.1',
  software: { name: 'a server', version: '2' },
  rest: [
    {
      mode: 'server',
      resource: [
        {
          type: 'Patient',
          interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'update' }],
          searchParam: [
            { name: 'name', type: 'string', documentation: 'a name' },
            { name: '_id', type: 'token' }
          ],
          searchInclude: ['Patient:organization'],
          searchRevInclude: ['Observation:subject']
        },
        { type: 'Observation', interaction: [{ code: 'read' }] }
      ]
    }
  ]
}

describe('capability', () => {
  it('reads what the server says it is', () => {
    const capability = capabilityOf(statement)

    expect(capability.fhirVersion).toBe('4.0.1')
    expect(capability.software).toBe('a server 2')
    expect(capability.types.map((entry) => entry.type)).toEqual(['Observation', 'Patient'])
  })

  it('reads the interactions a type offers', () => {
    const capability = capabilityOf(statement)

    expect(supports(capability, 'Patient', 'read')).toBe(true)
    expect(supports(capability, 'Patient', 'delete')).toBe(false)
    expect(supports(capability, 'Nothing', 'read')).toBe(false)
  })

  it('reads the parameters a type declares', () => {
    const capability = capabilityOf(statement)

    expect(searchParamsOf(capability, 'Patient').map((param) => param.name)).toEqual(['_id', 'name'])
    expect(searchParamsOf(capability, 'Observation')).toHaveLength(0)
    expect(searchParamsOf(capability, 'Nothing')).toHaveLength(0)
  })

  it('reads what a type may be joined with', () => {
    const capability = capabilityOf(statement)

    expect(includesOf(capability, 'Patient')).toEqual({
      includes: ['Patient:organization'],
      revIncludes: ['Observation:subject']
    })
    expect(includesOf(capability, 'Observation')).toEqual({ includes: [], revIncludes: [] })
  })

  it('finds a type it was told about and no other', () => {
    const capability = capabilityOf(statement)

    expect(typeOf(capability, 'Patient')?.type).toBe('Patient')
    expect(typeOf(capability, 'Nothing')).toBeUndefined()
  })

  it('reads a statement that declares nothing without inventing anything', () => {
    const capability = capabilityOf({ resourceType: 'CapabilityStatement' })

    expect(capability.types).toHaveLength(0)
    expect(capability.fhirVersion).toBeUndefined()
    expect(capability.software).toBeUndefined()
  })

  it('takes only what a server offers as a server', () => {
    const capability = capabilityOf({
      resourceType: 'CapabilityStatement',
      rest: [{ mode: 'client', resource: [{ type: 'Patient' }] }]
    })

    expect(capability.types).toHaveLength(0)
  })
})

describe('capability oddities', () => {
  it('ignores an entry that names no type', () => {
    const capability = capabilityOf({
      resourceType: 'CapabilityStatement',
      rest: [{ resource: [{ interaction: [{ code: 'read' }] }, { type: 'Patient' }] }]
    })

    expect(capability.types).toHaveLength(1)
  })

  it('ignores a parameter missing a name or a type', () => {
    const capability = capabilityOf({
      resourceType: 'CapabilityStatement',
      rest: [
        {
          resource: [
            { type: 'Patient', searchParam: [{ name: 'name' }, { type: 'string' }, { name: 'a', type: 'string' }] }
          ]
        }
      ]
    })

    expect(searchParamsOf(capability, 'Patient')).toHaveLength(1)
  })

  it('ignores an interaction with no code', () => {
    const capability = capabilityOf({
      resourceType: 'CapabilityStatement',
      rest: [{ resource: [{ type: 'Patient', interaction: [{}, { code: 'read' }] }] }]
    })

    expect(typeOf(capability, 'Patient')?.interactions).toEqual(['read'])
  })

  it('names software the server did not version', () => {
    expect(capabilityOf({ resourceType: 'CapabilityStatement', software: { name: 'a server' } }).software).toBe(
      'a server'
    )
  })

  it('reads a statement whose parts are not shaped as it expects', () => {
    const capability = capabilityOf({
      resourceType: 'CapabilityStatement',
      fhirVersion: 4,
      rest: 'none'
    })

    expect(capability.fhirVersion).toBeUndefined()
    expect(capability.types).toHaveLength(0)
  })
})
