import { describe, expect, it } from 'vitest'
import { childrenOf, definitionOf, elementAt, referencesOf, targetsOf } from './definition'

const structure = {
  resourceType: 'StructureDefinition',
  type: 'Observation',
  kind: 'resource',
  snapshot: {
    element: [
      { path: 'Observation', min: 0, max: '*' },
      { path: 'Observation.status', min: 1, max: '1', short: 'registered | final', type: [{ code: 'code' }] },
      {
        path: 'Observation.subject',
        min: 0,
        max: '1',
        type: [
          {
            code: 'Reference',
            targetProfile: [
              'http://hl7.org/fhir/StructureDefinition/Patient',
              'http://hl7.org/fhir/StructureDefinition/Group'
            ]
          }
        ]
      },
      { path: 'Observation.component', min: 0, max: '*', type: [{ code: 'BackboneElement' }] },
      { path: 'Observation.component.value[x]', min: 0, max: '1', type: [{ code: 'Quantity' }, { code: 'string' }] },
      {
        path: 'Observation.code',
        min: 1,
        max: '1',
        type: [{ code: 'CodeableConcept' }],
        binding: { strength: 'preferred', valueSet: 'http://example.org/vs' }
      }
    ]
  }
}

describe('definition', () => {
  it('reads the elements a type is made of', () => {
    const definition = definitionOf(structure)

    expect(definition.type).toBe('Observation')
    expect(definition.complete).toBe(true)
    expect(definition.elements).toHaveLength(5)
  })

  it('reads what an element requires and repeats', () => {
    const status = elementAt(definitionOf(structure), 'Observation.status')

    expect(status?.name).toBe('status')
    expect(status?.min).toBe(1)
    expect(status?.repeats).toBe(false)
    expect(status?.short).toBe('registered | final')
    expect(status?.types[0]?.code).toBe('code')
  })

  it('knows a repeating element', () => {
    expect(elementAt(definitionOf(structure), 'Observation.component')?.repeats).toBe(true)
  })

  it('reads where a reference may point', () => {
    const references = referencesOf(definitionOf(structure))

    expect(references).toHaveLength(1)
    expect(references[0]?.path).toBe('Observation.subject')
    expect(references[0]?.targets).toEqual(['Patient', 'Group'])
  })

  it('reads a choice of types as a choice', () => {
    const value = elementAt(definitionOf(structure), 'Observation.component.value[x]')

    expect(value?.choice).toBe(true)
    expect(value?.types.map((type) => type.code)).toEqual(['Quantity', 'string'])
  })

  it('reads the value set an element is bound to', () => {
    expect(elementAt(definitionOf(structure), 'Observation.code')?.binding).toBe('http://example.org/vs')
  })

  it('finds the elements directly under another', () => {
    const definition = definitionOf(structure)

    expect(childrenOf(definition, 'Observation').map((element) => element.name)).toEqual([
      'status',
      'subject',
      'component',
      'code'
    ])
    expect(childrenOf(definition, 'Observation.component').map((element) => element.name)).toEqual(['value[x]'])
  })

  it('falls back to what a server gave instead of a snapshot', () => {
    const definition = definitionOf({
      resourceType: 'StructureDefinition',
      type: 'Patient',
      differential: { element: [{ path: 'Patient.name', min: 0, max: '*' }] }
    })

    expect(definition.complete).toBe(false)
    expect(definition.elements).toHaveLength(1)
  })

  it('says plainly when a server described nothing', () => {
    const definition = definitionOf({ resourceType: 'StructureDefinition', type: 'Patient' })

    expect(definition.complete).toBe(false)
    expect(definition.elements).toHaveLength(0)
  })

  it('takes the type from the name when a server left it out', () => {
    expect(definitionOf({ resourceType: 'StructureDefinition', id: 'Patient' }).type).toBe('Patient')
    expect(definitionOf({ resourceType: 'StructureDefinition' }).type).toBe('')
  })
})

describe('definition oddities', () => {
  it('ignores an element with no path and the root itself', () => {
    const definition = definitionOf({
      resourceType: 'StructureDefinition',
      type: 'Patient',
      snapshot: { element: [{ min: 1 }, { path: 'Patient' }, { path: 'Patient.name' }] }
    })

    expect(definition.elements).toHaveLength(1)
  })

  it('ignores a type with no code and a profile that is not a string', () => {
    const definition = definitionOf({
      resourceType: 'StructureDefinition',
      type: 'Patient',
      snapshot: {
        element: [
          { path: 'Patient' },
          { path: 'Patient.link', type: [{ targetProfile: ['x'] }, { code: 'Reference', targetProfile: [3, 'a/B'] }] }
        ]
      }
    })

    expect(referencesOf(definition).flatMap(targetsOf)).toEqual(['B'])
  })

  it('reads a bare profile url as the type it names', () => {
    const definition = definitionOf({
      resourceType: 'StructureDefinition',
      type: 'Patient',
      snapshot: { element: [{ path: 'Patient' }, { path: 'Patient.link', type: [{ code: 'Reference', targetProfile: ['Patient'] }] }] }
    })

    expect(referencesOf(definition)[0]?.targets).toEqual(['Patient'])
  })

  it('takes an element without a maximum as repeating', () => {
    const definition = definitionOf({
      resourceType: 'StructureDefinition',
      type: 'Patient',
      snapshot: { element: [{ path: 'Patient' }, { path: 'Patient.name' }] }
    })

    expect(definition.elements[0]?.repeats).toBe(true)
    expect(definition.elements[0]?.min).toBe(0)
  })
})
