import { describe, expect, it } from 'vitest'
import { displayOf, referenceOf } from './display'

describe('what a resource is called', () => {
  it('takes a human name apart the way it is written', () => {
    expect(displayOf({ resourceType: 'Patient', name: [{ given: ['Ada'], family: 'Lovelace' }] })).toBe('Ada Lovelace')
  })

  it('takes the text of a name when it has no parts', () => {
    expect(displayOf({ resourceType: 'Patient', name: [{ text: 'Ada' }] })).toBe('Ada')
  })

  it('takes a title where a type has one', () => {
    expect(displayOf({ resourceType: 'Questionnaire', title: 'A form' })).toBe('A form')
  })

  it('takes the text of a code', () => {
    expect(displayOf({ resourceType: 'Observation', code: { text: 'a measurement' } })).toBe('a measurement')
  })

  it('takes what a coding displays, then the code itself', () => {
    expect(displayOf({ resourceType: 'Observation', code: { coding: [{ display: 'Weight' }] } })).toBe('Weight')
    expect(displayOf({ resourceType: 'Observation', code: { coding: [{ code: '29463-7' }] } })).toBe('29463-7')
  })

  it('reads the narrative a server wrote, without its markup', () => {
    expect(displayOf({ resourceType: 'Composition', text: { div: '<div><p>A note</p></div>' } })).toBe('A note')
  })

  it('falls back to the identity it has', () => {
    expect(displayOf({ resourceType: 'Patient', id: 'patient-0' })).toBe('patient-0')
    expect(displayOf({ resourceType: 'Patient' })).toBe('Patient')
  })

  it('says a number or a flag where a type carries one', () => {
    expect(displayOf({ resourceType: 'Thing', value: 3 })).toBe('3')
    expect(displayOf({ resourceType: 'Thing', value: false })).toBe('false')
  })

  it('looks through a list for the first thing worth saying', () => {
    expect(displayOf({ resourceType: 'Thing', name: [{}, { text: 'second' }] })).toBe('second')
  })

  it('ignores an empty narrative and an empty name', () => {
    expect(displayOf({ resourceType: 'Thing', text: { div: '<div>  </div>' }, id: 'thing' })).toBe('thing')
    expect(displayOf({ resourceType: 'Thing', name: 4 })).toBe('4')
  })

  it('names where a resource lives', () => {
    expect(referenceOf({ resourceType: 'Patient', id: '1' })).toBe('Patient/1')
    expect(referenceOf({ resourceType: 'Patient' })).toBe('Patient/')
  })
})
