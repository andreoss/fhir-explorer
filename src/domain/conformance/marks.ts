import type { TypeCapability } from './capability'

export type Marks = {
  readonly searchable: boolean
  readonly writable: boolean
}

function writable(entry: TypeCapability): boolean {
  return entry.interactions.includes('create') || entry.interactions.includes('update')
}

function searchable(entry: TypeCapability): boolean {
  return entry.interactions.includes('search-type')
}

export function marksOf(entry: TypeCapability): Marks {
  return { searchable: searchable(entry), writable: writable(entry) }
}

export function distinguishing(types: readonly TypeCapability[]): Marks {
  const some = types.some(searchable)
  const every = types.every(searchable)
  const someWritten = types.some(writable)
  const everyWritten = types.every(writable)

  return {
    searchable: types.length > 0 && some && !every,
    writable: types.length > 0 && someWritten && !everyWritten
  }
}

export function lettersOf(types: readonly TypeCapability[]): readonly string[] {
  return [...new Set(types.map((entry) => entry.type.slice(0, 1).toUpperCase()))].sort((left, right) =>
    left.localeCompare(right)
  )
}

export function groupedBy(types: readonly TypeCapability[]): readonly (readonly [string, readonly TypeCapability[]])[] {
  const held = new Map<string, TypeCapability[]>()

  for (const entry of types) {
    const letter = entry.type.slice(0, 1).toUpperCase()

    held.set(letter, [...(held.get(letter) ?? []), entry])
  }

  return [...held.entries()].sort((left, right) => left[0].localeCompare(right[0]))
}
