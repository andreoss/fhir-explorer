import { list, record, text } from './json'
import type { Json, Resource } from './types'

export type Pointing = {
  readonly path: string
  readonly reference: string
  readonly type: string
  readonly id: string
  readonly display?: string
}

function pointingAt(value: Json | undefined, path: string): Pointing[] {
  const entry = record(value)
  const reference = text(entry?.reference)

  if (entry === undefined || reference === undefined) {
    return []
  }

  const parts = reference.split('/')
  const id = parts.pop() ?? ''
  const type = text(entry.type) ?? parts.pop() ?? ''

  if (type.length === 0 || id.length === 0 || reference.startsWith('#')) {
    return []
  }

  const display = text(entry.display)

  return [{ path, reference, type, id, ...(display === undefined ? {} : { display }) }]
}

function walk(value: Json | undefined, path: string): Pointing[] {
  const found = pointingAt(value, path)

  if (found.length > 0) {
    return found
  }

  if (Array.isArray(value)) {
    return list(value).flatMap((item, index) => walk(item, `${path}[${String(index)}]`))
  }

  const entry = record(value)

  if (entry === undefined) {
    return []
  }

  return Object.entries(entry).flatMap(([name, item]) => walk(item, path === '' ? name : `${path}.${name}`))
}

export function pointingFrom(resource: Resource): readonly Pointing[] {
  return Object.entries(resource)
    .filter(([name]) => name !== 'resourceType' && name !== 'id' && name !== 'meta')
    .flatMap(([name, value]) => walk(value, name))
}

export function versionedOf(reference: string): string {
  return reference.split('/_history/')[0] ?? reference
}
