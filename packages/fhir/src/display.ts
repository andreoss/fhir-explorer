import { list, record, text } from './json'
import type { Json, Resource } from './types'

const NAMED = ['name', 'title', 'display', 'text', 'description', 'code', 'type', 'identifier', 'value']

export function humanName(value: Json | undefined): string | undefined {
  const entry = record(value)

  if (entry === undefined) {
    return undefined
  }

  const given = list(entry.given)
    .flatMap((part) => (typeof part === 'string' ? [part] : []))
    .join(' ')
  const family = text(entry.family)
  const together = [given, family].filter((part) => part !== undefined && part.length > 0).join(' ')

  return together.length > 0 ? together : text(entry.text)
}

function narrative(value: Json | undefined): string | undefined {
  const div = text(record(value)?.div)

  if (div === undefined) {
    return undefined
  }

  const stripped = div.replaceAll(/<[^>]*>/g, ' ').replaceAll(/\s+/g, ' ').trim()

  return stripped.length > 0 ? stripped : undefined
}

export function quantityDisplay(value: Json | undefined): string | undefined {
  const entry = record(value)

  if (entry === undefined || typeof entry.value !== 'number') {
    return undefined
  }

  const unit = text(entry.unit) ?? text(entry.code)

  return unit === undefined ? String(entry.value) : `${String(entry.value)} ${unit}`
}

export function codeDisplay(value: Json | undefined): string | undefined {
  const entry = record(value)

  if (entry === undefined) {
    return undefined
  }

  const said = text(entry.text)

  if (said !== undefined) {
    return said
  }

  const first = record(list(entry.coding)[0])
  const display = text(first?.display)

  if (display !== undefined) {
    return display
  }

  const code = text(first?.code) ?? text(entry.code)

  return code
}

function shown(value: Json | undefined): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    for (const item of value as readonly Json[]) {
      const said = shown(item)

      if (said !== undefined) {
        return said
      }
    }

    return undefined
  }

  return humanName(value) ?? narrative(value) ?? codeDisplay(value) ?? text(record(value)?.value)
}

export function displayElementOf(resource: Resource): string | undefined {
  for (const element of NAMED) {
    const said = shown(resource[element])

    if (said !== undefined && said.length > 0) {
      return element
    }
  }

  return undefined
}

export function displayOf(resource: Resource): string {
  for (const element of NAMED) {
    const said = shown(resource[element])

    if (said !== undefined && said.length > 0) {
      return said
    }
  }

  return resource.id ?? resource.resourceType
}

export function referenceOf(resource: Resource): string {
  return `${resource.resourceType}/${resource.id ?? ''}`
}
