import type { Json, Resource } from '../fhir/types'
import { list, record, strings, text } from '../fhir/json'
import { fields } from '../fhir/types'

export type SearchParam = {
  readonly name: string
  readonly type: string
  readonly documentation?: string
}

export type TypeCapability = {
  readonly type: string
  readonly interactions: readonly string[]
  readonly searchParams: readonly SearchParam[]
  readonly includes: readonly string[]
  readonly revIncludes: readonly string[]
}

export type ServerCapability = {
  readonly fhirVersion?: string
  readonly software?: string
  readonly types: readonly TypeCapability[]
}

function paramOf(value: Json): SearchParam[] {
  const entry = record(value)
  const name = text(entry?.name)
  const type = text(entry?.type)

  if (name === undefined || type === undefined) {
    return []
  }

  const documentation = text(entry?.documentation)

  return [{ name, type, ...(documentation === undefined ? {} : { documentation }) }]
}

function typeOfEntry(value: Json): TypeCapability[] {
  const entry = record(value)
  const type = text(entry?.type)

  if (type === undefined) {
    return []
  }

  return [
    {
      type,
      interactions: list(entry?.interaction)
        .flatMap((item) => {
          const code = text(record(item)?.code)
          return code === undefined ? [] : [code]
        })
        .sort((left, right) => left.localeCompare(right)),
      searchParams: list(entry?.searchParam)
        .flatMap(paramOf)
        .sort((left, right) => left.name.localeCompare(right.name)),
      includes: strings(entry?.searchInclude),
      revIncludes: strings(entry?.searchRevInclude)
    }
  ]
}

export function capabilityOf(resource: Resource): ServerCapability {
  const source = fields(resource)
  const software = record(source.software)
  const name = text(software?.name)
  const version = text(software?.version)
  const fhirVersion = text(source.fhirVersion)
  const described = name === undefined ? undefined : version === undefined ? name : `${name} ${version}`

  const types = list(source.rest)
    .filter((rest) => text(record(rest)?.mode) !== 'client')
    .flatMap((rest) => list(record(rest)?.resource).flatMap(typeOfEntry))
    .sort((left, right) => left.type.localeCompare(right.type))

  return {
    ...(fhirVersion === undefined ? {} : { fhirVersion }),
    ...(described === undefined ? {} : { software: described }),
    types
  }
}

export function typeOf(capability: ServerCapability, type: string): TypeCapability | undefined {
  return capability.types.find((entry) => entry.type === type)
}

export function supports(capability: ServerCapability, type: string, interaction: string): boolean {
  return typeOf(capability, type)?.interactions.includes(interaction) ?? false
}

export function searchParamsOf(capability: ServerCapability, type: string): readonly SearchParam[] {
  return typeOf(capability, type)?.searchParams ?? []
}

export function includesOf(
  capability: ServerCapability,
  type: string
): { readonly includes: readonly string[]; readonly revIncludes: readonly string[] } {
  const entry = typeOf(capability, type)

  return { includes: entry?.includes ?? [], revIncludes: entry?.revIncludes ?? [] }
}
