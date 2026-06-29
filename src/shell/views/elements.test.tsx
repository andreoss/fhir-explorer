import { HashRouter, Route } from '@solidjs/router'
import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { definitionOf } from '@lib/conformance'
import type { Resource } from '@lib/fhir'
import type { Described } from './elements'
import { Elements } from './elements'
import { TextProvider } from '../text'

const definition = definitionOf({
  resourceType: 'StructureDefinition',
  type: 'Observation',
  snapshot: { element: [{ path: 'Observation' }, { path: 'Observation.status', short: 'the state it is in' }] }
})

function mount(resource: Resource, described: Described = { definition: undefined, root: 'Observation' }) {
  return render(() => (
    <TextProvider>
      <HashRouter>
        <Route path="*" component={() => <Elements resource={resource} described={described} />} />
      </HashRouter>
    </TextProvider>
  ))
}

describe('elements of a resource', () => {
  it('names an element as the server describes it, or as it is written', () => {
    const labelled = mount({ resourceType: 'Observation', status: 'final' }, { definition, root: 'Observation' })
    const plain = mount({ resourceType: 'Observation', status: 'final' })

    expect(labelled.getByText('the state it is in')).toBeInTheDocument()
    expect(plain.getByText('Status')).toBeInTheDocument()
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

    expect(screen.getAllByText('Component').length).toBeGreaterThan(0)
    expect(screen.getByText('3 kg')).toBeInTheDocument()
  })

  it('names an element once, however deeply a list of one is nested', () => {
    const screen = mount({ resourceType: 'Patient', name: [{ family: 'Lovelace', given: ['Ada'] }] })

    expect(screen.getAllByText('Name')).toHaveLength(1)
    expect(screen.getByText('Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Ada')).toBeInTheDocument()
  })

  it('says a flag as a reader would say it, and a number plainly', () => {
    const screen = mount({ resourceType: 'Patient', deceasedBoolean: false, multipleBirthInteger: 2 })

    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

describe('an element tree a reader can fold', () => {
  it('folds a list of several, and says how many', () => {
    const screen = mount({
      resourceType: 'Patient',
      contact: [{ name: { family: 'Reed' } }, { name: { family: 'Okafor' } }]
    })

    expect(screen.getByTestId('fold')).toBeInTheDocument()
    expect(screen.getByText('2 items')).toBeInTheDocument()
    expect(screen.getByText('Reed')).toBeInTheDocument()
  })

  it('folds nothing where there is nothing to fold', () => {
    const screen = mount({ resourceType: 'Patient', name: [{ family: 'Only' }] })

    expect(screen.queryByTestId('fold')).not.toBeInTheDocument()
    expect(screen.getByText('Only')).toBeInTheDocument()
  })

  it('leaves out what the line above the tree already says', () => {
    const screen = mount({
      resourceType: 'Patient',
      id: 'p1',
      meta: { versionId: '1', lastUpdated: '2026-09-25T06:05:39Z' },
      name: [{ family: 'Only' }]
    })

    expect(screen.queryByText('p1')).not.toBeInTheDocument()
    expect(screen.queryByText('Id')).not.toBeInTheDocument()
    expect(screen.queryByText('Meta')).not.toBeInTheDocument()
    expect(screen.getByText('Only')).toBeInTheDocument()
  })

  it('names every element in one column, however deep it sits', () => {
    const screen = mount({
      resourceType: 'Patient',
      name: [{ family: 'Only', given: ['Ada'] }],
      contact: [{ name: { family: 'Reed' } }, { name: { family: 'Okafor' } }]
    })

    const deepest = screen.container.querySelectorAll('.element > .name')

    expect(deepest.length).toBeGreaterThan(2)
    for (const one of deepest) {
      expect(one.getAttribute('style')).toContain('--depth')
    }
  })

  it('leaves a long list folded until a reader asks for it', () => {
    const many = Array.from({ length: 9 }, (_, at) => ({ family: `Family ${String(at)}` }))
    const screen = mount({ resourceType: 'Patient', name: many })

    const first = screen.container.querySelector('details')

    expect(first?.open).toBe(false)
  })

  it('opens a short list without being asked', () => {
    const screen = mount({ resourceType: 'Patient', name: [{ family: 'One' }, { family: 'Two' }] })

    const first = screen.container.querySelector('details')

    expect(first?.open).toBe(true)
  })
})
