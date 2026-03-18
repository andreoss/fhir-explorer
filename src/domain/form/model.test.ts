import { describe, expect, it } from 'vitest'
import { definitionOf } from '../conformance/definition'
import { formOf, troublesFromServer, troublesIn } from './model'

const definition = definitionOf({
  resourceType: 'StructureDefinition',
  type: 'Observation',
  snapshot: {
    element: [
      { path: 'Observation' },
      { path: 'Observation.id', type: [{ code: 'id' }] },
      { path: 'Observation.meta', type: [{ code: 'Meta' }] },
      { path: 'Observation.status', min: 1, max: '1', type: [{ code: 'code' }], short: 'the state it is in' },
      { path: 'Observation.issued', min: 0, max: '1', type: [{ code: 'instant' }] },
      { path: 'Observation.valueInteger', min: 0, max: '1', type: [{ code: 'integer' }] },
      { path: 'Observation.absent', min: 0, max: '1', type: [{ code: 'boolean' }] },
      { path: 'Observation.code', min: 1, max: '1', type: [{ code: 'CodeableConcept' }] },
      { path: 'Observation.value[x]', min: 0, max: '1', type: [{ code: 'Quantity' }, { code: 'string' }] },
      { path: 'Observation.component', min: 0, max: '*', type: [{ code: 'BackboneElement' }] },
      { path: 'Observation.component.code', min: 1, max: '1', type: [{ code: 'CodeableConcept' }] }
    ]
  }
})

describe('a form from a description', () => {
  it('has a field for each element, without the ones a server owns', () => {
    const fields = formOf(definition)

    expect(fields.map((field) => field.name)).toEqual([
      'status',
      'issued',
      'valueInteger',
      'absent',
      'code',
      'value[x]',
      'component'
    ])
  })

  it('knows what a field is for', () => {
    const fields = formOf(definition)
    const kinds = Object.fromEntries(fields.map((field) => [field.name, field.kind]))

    expect(kinds).toMatchObject({
      status: 'text',
      issued: 'text',
      valueInteger: 'number',
      absent: 'flag',
      code: 'json',
      'value[x]': 'json',
      component: 'nested'
    })
  })

  it('knows what a server requires and what repeats', () => {
    const fields = formOf(definition)
    const status = fields.find((field) => field.name === 'status')
    const component = fields.find((field) => field.name === 'component')

    expect(status).toMatchObject({ required: true, repeats: false, label: 'the state it is in' })
    expect(component).toMatchObject({ required: false, repeats: true })
    expect(component?.children.map((child) => child.name)).toEqual(['code'])
  })

  it('has no fields at all where a server describes nothing', () => {
    expect(formOf({ type: 'Patient', complete: false, elements: [] })).toHaveLength(0)
  })
})

describe('what is wrong with what was typed', () => {
  const fields = formOf(definition)

  it('says which required element was left out', () => {
    const troubles = troublesIn(fields, { resourceType: 'Observation' }, 'Observation')

    expect(troubles.map((trouble) => trouble.path)).toEqual(['Observation.status', 'Observation.code'])
  })

  it('takes an empty string as nothing at all', () => {
    const troubles = troublesIn(fields, { resourceType: 'Observation', status: '  ', code: {} }, 'Observation')

    expect(troubles.map((trouble) => trouble.path)).toEqual(['Observation.status'])
  })

  it('says when a number is not one, and a flag is not one', () => {
    const troubles = troublesIn(
      fields,
      { resourceType: 'Observation', status: 'final', code: {}, valueInteger: 'three', absent: 'yes' },
      'Observation'
    )

    expect(troubles).toEqual([
      { path: 'Observation.valueInteger', message: 'not a number' },
      { path: 'Observation.absent', message: 'not a flag' }
    ])
  })

  it('finds nothing wrong with what is right', () => {
    expect(
      troublesIn(fields, { resourceType: 'Observation', status: 'final', code: { text: 'a' } }, 'Observation')
    ).toHaveLength(0)
  })

  it('carries what the server said against the element it named', () => {
    expect(
      troublesFromServer([
        { code: 'invalid', diagnostics: 'no such code', expression: ['Observation.status'] },
        { code: 'required' }
      ])
    ).toEqual([
      { path: 'Observation.status', message: 'no such code' },
      { path: '', message: 'required' }
    ])
  })
})
