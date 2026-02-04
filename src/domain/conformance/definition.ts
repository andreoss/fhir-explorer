import type { Json, Resource } from '../fhir/types'
import { count, list, record, text } from '../fhir/json'
import { fields } from '../fhir/types'

export type ElementType = {
  readonly code: string
  readonly targets: readonly string[]
}

export type Element = {
  readonly path: string
  readonly name: string
  readonly parent: string
  readonly min: number
  readonly repeats: boolean
  readonly choice: boolean
  readonly types: readonly ElementType[]
  readonly short?: string
  readonly binding?: string
}

export type ReferenceElement = {
  readonly targets: readonly string[]
} & Element

export type TypeDefinition = {
  readonly type: string
  readonly complete: boolean
  readonly elements: readonly Element[]
}

function lastSegment(url: string): string {
  return url.split('/').pop() ?? url
}

function typeOfEntry(value: Json): ElementType[] {
  const entry = record(value)
  const code = text(entry?.code)

  if (code === undefined) {
    return []
  }

  const targets = list(entry?.targetProfile).flatMap((profile) => {
    const url = text(profile)
    return url === undefined ? [] : [lastSegment(url)]
  })

  return [{ code, targets }]
}

function elementOf(value: Json): Element[] {
  const entry = record(value)
  const path = text(entry?.path)

  if (!path?.includes('.')) {
    return []
  }

  const segments = path.split('.')
  const name = segments[segments.length - 1] ?? path
  const short = text(entry?.short)
  const binding = text(record(entry?.binding)?.valueSet)

  return [
    {
      path,
      name,
      parent: segments.slice(0, -1).join('.'),
      min: count(entry?.min),
      repeats: text(entry?.max) !== '1',
      choice: name.endsWith('[x]'),
      types: list(entry?.type).flatMap(typeOfEntry),
      ...(short === undefined ? {} : { short }),
      ...(binding === undefined ? {} : { binding })
    }
  ]
}

export function definitionOf(resource: Resource): TypeDefinition {
  const source = fields(resource)
  const snapshot = list(record(source.snapshot)?.element)
  const differential = list(record(source.differential)?.element)
  const complete = snapshot.length > 0
  const elements = (complete ? snapshot : differential).flatMap(elementOf)

  return {
    type: text(source.type) ?? text(source.id) ?? '',
    complete,
    elements
  }
}

export function elementAt(definition: TypeDefinition, path: string): Element | undefined {
  return definition.elements.find((element) => element.path === path)
}

export function childrenOf(definition: TypeDefinition, path: string): readonly Element[] {
  return definition.elements.filter((element) => element.parent === path)
}

export function referencesOf(definition: TypeDefinition): readonly ReferenceElement[] {
  return definition.elements
    .filter((element) => element.types.some((type) => type.code === 'Reference'))
    .map((element) => ({ ...element, targets: targetsOf(element) }))
}

export function targetsOf(element: Element): readonly string[] {
  return element.types.flatMap((type) => type.targets)
}
