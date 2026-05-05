import { describe, expect, it } from 'vitest'
import { changesBetween } from './changes'

const before = {
  resourceType: 'Patient',
  id: 'p1',
  meta: { versionId: '2' },
  active: true,
  gender: 'female',
  name: [{ family: 'Lovelace' }]
}

describe('what a form is about to write', () => {
  it('says nothing about a resource nobody touched', () => {
    expect(changesBetween(before, { ...before })).toHaveLength(0)
  })

  it('names the element that changed, and what it was', () => {
    const changed = changesBetween(before, { ...before, gender: 'male' })

    expect(changed).toEqual([{ path: 'gender', from: 'female', to: 'male' }])
  })

  it('names an element that was added and one that was taken away', () => {
    const added = changesBetween(before, { ...before, birthDate: '1979-12-10' })
    const gone = changesBetween(before, { resourceType: 'Patient', id: 'p1', active: true, name: before.name })

    expect(added).toEqual([{ path: 'birthDate', from: '', to: '1979-12-10' }])
    expect(gone).toEqual([{ path: 'gender', from: 'female', to: '' }])
  })

  it('reaches into what nests', () => {
    const changed = changesBetween(before, { ...before, name: [{ family: 'Byron' }] })

    expect(changed).toEqual([{ path: 'name.0.family', from: 'Lovelace', to: 'Byron' }])
  })

  it('says nothing about what the server owns', () => {
    const changed = changesBetween(before, { ...before, meta: { versionId: '3' }, id: 'other' })

    expect(changed).toHaveLength(0)
  })

  it('takes a resource that is not there yet as everything being new', () => {
    expect(changesBetween(undefined, { resourceType: 'Patient', gender: 'male' })).toEqual([
      { path: 'gender', from: '', to: 'male' }
    ])
  })
})
