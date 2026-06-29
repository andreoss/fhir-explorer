import { describe, expect, it } from 'vitest'
import { capabilityOf } from './capability'
import { distinguishing, groupedBy, lettersOf, marksOf } from './marks'

function typesOf(resource: readonly { type: string; interaction: { code: string }[] }[]) {
  return capabilityOf({ resourceType: 'CapabilityStatement', rest: [{ mode: 'server', resource }] }).types
}

const mixed = typesOf([
  { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'update' }] },
  { type: 'Binary', interaction: [{ code: 'read' }] },
  { type: 'Observation', interaction: [{ code: 'read' }, { code: 'search-type' }] }
])

const alike = typesOf([
  { type: 'Patient', interaction: [{ code: 'search-type' }, { code: 'create' }] },
  { type: 'Observation', interaction: [{ code: 'search-type' }, { code: 'create' }] }
])

describe('what a mark says about a type', () => {
  const at = (name: string) => {
    const found = mixed.find((entry) => entry.type === name)

    if (found === undefined) {
      throw new Error(`no such type: ${name}`)
    }

    return found
  }

  it('says whether it can be searched and whether it can be written', () => {
    expect(marksOf(at('Observation'))).toEqual({ searchable: true, writable: false })
    expect(marksOf(at('Binary'))).toEqual({ searchable: false, writable: false })
    expect(marksOf(at('Patient'))).toEqual({ searchable: true, writable: true })
  })
})

describe('which marks are worth showing', () => {
  it('shows a mark that sets some types apart from others', () => {
    expect(distinguishing(mixed)).toEqual({ searchable: true, writable: true })
  })

  it('shows no mark that every type carries', () => {
    expect(distinguishing(alike)).toEqual({ searchable: false, writable: false })
  })

  it('shows no mark where there are no types', () => {
    expect(distinguishing([])).toEqual({ searchable: false, writable: false })
  })
})

describe('walking a long list', () => {
  it('names the letters the types start with', () => {
    expect(lettersOf(mixed)).toEqual(['B', 'O', 'P'])
  })

  it('gathers the types under those letters', () => {
    const grouped = groupedBy(mixed)

    expect(grouped.map(([letter]) => letter)).toEqual(['B', 'O', 'P'])
    expect(grouped[0]?.[1].map((entry) => entry.type)).toEqual(['Binary'])
  })

  it('has nothing to gather from nothing', () => {
    expect(groupedBy([])).toHaveLength(0)
    expect(lettersOf([])).toHaveLength(0)
  })
})
