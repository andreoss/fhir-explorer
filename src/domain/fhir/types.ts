export type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | { readonly [key: string]: Json }

export interface Meta {
  readonly versionId?: string
  readonly lastUpdated?: string
  readonly profile?: readonly string[]
}

export interface Resource {
  readonly resourceType: string
  readonly id?: string
  readonly meta?: Meta
}

export interface Reference {
  readonly reference?: string
  readonly type?: string
  readonly display?: string
}

export interface BundleLink {
  readonly relation: string
  readonly url: string
}

export interface BundleEntry {
  readonly fullUrl?: string
  readonly resource?: Resource
  readonly search?: { readonly mode?: string }
}

export interface Bundle extends Resource {
  readonly type?: string
  readonly total?: number
  readonly link?: readonly BundleLink[]
  readonly entry?: readonly BundleEntry[]
}

export interface Issue {
  readonly severity: string
  readonly code: string
  readonly diagnostics?: string
  readonly expression?: readonly string[]
}

export interface OperationOutcome extends Resource {
  readonly issue?: readonly Issue[]
}

export function fields(resource: Resource): Readonly<Record<string, Json | undefined>> {
  return resource as unknown as Readonly<Record<string, Json | undefined>>
}

export function isResource(value: Json | undefined): value is Resource & Record<string, Json> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { resourceType?: Json }).resourceType === 'string'
  )
}

export function isBundle(resource: Resource): resource is Bundle {
  return resource.resourceType === 'Bundle'
}

export function isOutcome(resource: Resource): resource is OperationOutcome {
  return resource.resourceType === 'OperationOutcome'
}
