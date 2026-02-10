import { describe, expect, it } from 'vitest'
import { capabilityOf, supports } from './capability'
import { definitionOf } from './definition'

const statement = (release: string) => ({
  resourceType: 'CapabilityStatement',
  fhirVersion: release,
  rest: [{ mode: 'server', resource: [{ type: 'Patient', interaction: [{ code: 'read' }] }] }]
})

const structure = (release: string) => ({
  resourceType: 'StructureDefinition',
  type: 'Patient',
  version: release,
  snapshot: {
    element: [{ path: 'Patient' }, { path: 'Patient.name', min: 0, max: '*', type: [{ code: 'HumanName' }] }]
  }
})

describe('releases', () => {
  it('reads what two releases declare the same way', () => {
    const older = capabilityOf(statement('3.0.2'))
    const newer = capabilityOf(statement('5.0.0'))

    expect(older.types).toEqual(newer.types)
    expect(supports(older, 'Patient', 'read')).toBe(supports(newer, 'Patient', 'read'))
    expect(older.fhirVersion).not.toBe(newer.fhirVersion)
  })

  it('describes a type from two releases the same way', () => {
    expect(definitionOf(structure('3.0.2')).elements).toEqual(definitionOf(structure('5.0.0')).elements)
  })

  it('carries what the server said its release is without acting on it', () => {
    expect(capabilityOf(statement('4.3.0')).fhirVersion).toBe('4.3.0')
  })
})
