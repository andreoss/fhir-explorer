import { codeDisplay, displayElementOf, displayOf, humanName, quantityDisplay, referenceOf } from './display'
import { list, record, text } from './json'
import { shortId } from './readable'
import type { Json, Resource } from './types'

const OWNED = new Set(['resourceType', 'id', 'meta', 'text', 'implicitRules', 'language', 'contained', 'extension'])

export type Fact = {
  readonly name: string
  readonly said: string
  readonly truth?: boolean
}

function saidOf(value: Json | undefined): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  const entry = record(value)

  if (entry !== undefined) {
    const named = humanName(value)

    if (named !== undefined) {
      return named
    }

    const measured = quantityDisplay(value)

    if (measured !== undefined) {
      return measured
    }

    const coded = codeDisplay(value)

    if (coded !== undefined) {
      return coded
    }

    const said = text(entry.display)

    if (said !== undefined) {
      return said
    }

    const reference = text(entry.reference)

    if (reference !== undefined) {
      return shortId(reference)
    }

    const start = text(entry.start)

    if (start !== undefined) {
      return start
    }

    return undefined
  }

  const first = list(value)[0]

  return first === undefined ? undefined : saidOf(first)
}

export function factsOf(resource: Resource, many = 8): readonly Fact[] {
  return Object.entries(resource)
    .filter(([name]) => !OWNED.has(name))
    .flatMap(([name, value]) => {
      const said = saidOf(value)

      if (said === undefined || said.length === 0) {
        return []
      }

      return [typeof value === 'boolean' ? { name, said, truth: value } : { name, said }]
    })
    .slice(0, many)
}

export function columnsOf(resources: readonly Resource[], many = 3): readonly string[] {
  const counted = new Map<string, number>()
  const named = new Set(resources.flatMap((resource) => [displayElementOf(resource) ?? '']))

  for (const resource of resources) {
    for (const fact of factsOf(resource, 24)) {
      if (named.has(fact.name)) {
        continue
      }

      counted.set(fact.name, (counted.get(fact.name) ?? 0) + 1)
    }
  }

  return [...counted.entries()]
    .filter(([, held]) => held > resources.length / 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, many)
    .map(([name]) => name)
}

export function saidAt(resource: Resource, name: string): string {
  return saidOf(resource[name]) ?? ''
}

export function truthAt(resource: Resource, name: string): boolean | undefined {
  const value = resource[name]

  return typeof value === 'boolean' ? value : undefined
}

export function titleOf(resource: Resource): string {
  return displayOf(resource)
}

export function shownOf(resource: Resource): string {
  const said = displayOf(resource)

  return said === resource.id ? shortId(referenceOf(resource)) : said
}
