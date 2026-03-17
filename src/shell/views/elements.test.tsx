import { HashRouter, Route } from '@solidjs/router'
import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { definitionOf } from '../../domain/conformance/definition'
import type { Resource } from '../../domain/fhir/types'
import type { Described } from './elements'
import { Elements } from './elements'

const definition = definitionOf({
  resourceType: 'StructureDefinition',
  type: 'Observation',
  snapshot: { element: [{ path: 'Observation' }, { path: 'Observation.status', short: 'the state it is in' }] }
})

function mount(resource: Resource, described: Described = { definition: undefined, root: 'Observation' }) {
  return render(() => (
    <HashRouter>
      <Route path="*" component={() => <Elements resource={resource} described={described} />} />
    </HashRouter>
  ))
}

describe('elements of a resource', () => {
  it('names an element as the server describes it, or as it is written', () => {
    const labelled = mount({ resourceType: 'Observation', status: 'final' }, { definition, root: 'Observation' })
    const plain = mount({ resourceType: 'Observation', status: 'final' })

    expect(labelled.getByText('the state it is in')).toBeInTheDocument()
    expect(plain.getByText('status')).toBeInTheDocument()
  })

  it('shows a code as what it displays', () => {
    const screen = mount({
      resourceType: 'Observation',
      code: { coding: [{ code: '29463-7', display: 'Body weight' }] }
    })

    expect(screen.getByText('Body weight')).toBeInTheDocument()
    expect(screen.queryByText('29463-7')).not.toBeInTheDocument()
  })

  it('shows a code as its code where nothing displays it', () => {
    const screen = mount({ resourceType: 'Observation', code: { coding: [{ code: '29463-7' }] } })

    expect(screen.getByText('29463-7')).toBeInTheDocument()
  })

  it('makes a reference a place to go', () => {
    const screen = mount({ resourceType: 'Observation', subject: { reference: 'Patient/p1', display: 'Ada' } })

    expect(screen.getByRole('link', { name: 'Ada' }).getAttribute('href')).toBe('#/type/Patient/p1')
  })

  it('leaves a reference into the resource itself alone', () => {
    const screen = mount({ resourceType: 'Observation', subject: { reference: '#contained' } })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('walks into what repeats and what nests', () => {
    const screen = mount({
      resourceType: 'Observation',
      component: [{ valueQuantity: { value: 3, unit: 'kg' } }]
    })

    expect(screen.getByText('component 1')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('kg')).toBeInTheDocument()
  })

  it('says a flag and a number plainly', () => {
    const screen = mount({ resourceType: 'Patient', deceasedBoolean: false, multipleBirthInteger: 2 })

    expect(screen.getByText('false')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
