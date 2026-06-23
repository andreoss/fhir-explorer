import { childrenOf } from '../conformance'
import type { Element, TypeDefinition } from '../conformance'
import { record } from '../fhir'
import type { Json, Resource } from '../fhir'

export type FieldKind = 'text' | 'number' | 'flag' | 'choice' | 'nested' | 'json'

export type Field = {
  readonly name: string
  readonly path: string
  readonly label: string
  readonly kind: FieldKind
  readonly required: boolean
  readonly repeats: boolean
  readonly type: string
  readonly children: readonly Field[]
}

const PRIMITIVE: Readonly<Record<string, FieldKind>> = {
  string: 'text',
  code: 'text',
  uri: 'text',
  url: 'text',
  canonical: 'text',
  id: 'text',
  markdown: 'text',
  date: 'text',
  dateTime: 'text',
  instant: 'text',
  time: 'text',
  oid: 'text',
  uuid: 'text',
  base64Binary: 'text',
  integer: 'number',
  positiveInt: 'number',
  unsignedInt: 'number',
  decimal: 'number',
  boolean: 'flag'
}

function kindOf(element: Element, nested: boolean): FieldKind {
  const type = element.types[0]?.code ?? ''

  if (nested) {
    return 'nested'
  }

  if (element.choice) {
    return 'json'
  }

  return PRIMITIVE[type] ?? 'json'
}

function fieldOf(definition: TypeDefinition, element: Element): Field {
  const children = childrenOf(definition, element.path)

  return {
    name: element.name,
    path: element.path,
    label: element.short ?? element.name,
    kind: kindOf(element, children.length > 0),
    required: element.min > 0,
    repeats: element.repeats,
    type: element.types[0]?.code ?? '',
    children: children.map((child) => fieldOf(definition, child))
  }
}

export function formOf(definition: TypeDefinition): readonly Field[] {
  if (!definition.complete) {
    return []
  }

  return childrenOf(definition, definition.type)
    .filter((element) => element.name !== 'id' && element.name !== 'meta')
    .map((element) => fieldOf(definition, element))
}

export type Trouble = {
  readonly path: string
  readonly message: string
}

function valueAt(resource: Resource, path: readonly string[]): Json | undefined {
  let held: Json | undefined = record(resource as unknown as Json)

  for (const step of path) {
    const entry = record(held)

    if (entry === undefined) {
      return undefined
    }

    held = entry[step]
  }

  return held
}

function missing(value: Json | undefined): boolean {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  return Array.isArray(value) && value.length === 0
}

export function troublesIn(fields: readonly Field[], resource: Resource, root: string): readonly Trouble[] {
  return fields.flatMap((field) => {
    const steps = field.path.slice(root.length + 1).split('.')
    const value = valueAt(resource, steps)
    const here: Trouble[] = field.required && missing(value) ? [{ path: field.path, message: 'required' }] : []
    const number =
      field.kind === 'number' && value !== undefined && typeof value !== 'number'
        ? [{ path: field.path, message: 'not a number' }]
        : []
    const flag =
      field.kind === 'flag' && value !== undefined && typeof value !== 'boolean'
        ? [{ path: field.path, message: 'not a flag' }]
        : []

    return [...here, ...number, ...flag]
  })
}

export function troublesFromServer(issues: readonly { readonly expression?: readonly string[]; readonly diagnostics?: string; readonly code: string }[]): readonly Trouble[] {
  return issues.flatMap((issue) =>
    (issue.expression ?? ['']).map((expression) => ({
      path: expression,
      message: issue.diagnostics ?? issue.code
    }))
  )
}
