import { record } from '../fhir'
import type { Json, Resource } from '../fhir'

export type Change = {
  readonly path: string
  readonly from: string
  readonly to: string
}

const OWNED = new Set(['meta', 'id', 'resourceType'])

function said(value: Json | undefined): string {
  if (value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value)
}

function walk(before: Json | undefined, after: Json | undefined, path: string, into: Change[]): void {
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const one = before as readonly Json[]
    const other = after as readonly Json[]
    const many = Math.max(one.length, other.length)

    for (let at = 0; at < many; at += 1) {
      walk(one[at], other[at], `${path}.${String(at)}`, into)
    }

    return
  }

  const one = record(before)
  const other = record(after)

  if (one !== undefined && other !== undefined) {
    for (const name of new Set([...Object.keys(one), ...Object.keys(other)])) {
      walk(one[name], other[name], path.length === 0 ? name : `${path}.${name}`, into)
    }

    return
  }

  into.push({ path, from: said(before), to: said(after) })
}

export function changesBetween(before: Resource | undefined, after: Resource | undefined): readonly Change[] {
  const into: Change[] = []
  const one = before ?? {}
  const other = after ?? {}

  for (const name of new Set([...Object.keys(one), ...Object.keys(other)])) {
    if (OWNED.has(name)) {
      continue
    }

    walk((one as Record<string, Json | undefined>)[name], (other as Record<string, Json | undefined>)[name], name, into)
  }

  return into
}
