export type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | { readonly [key: string]: Json }

export type Meta = {
  readonly versionId?: string
  readonly lastUpdated?: string
  readonly profile?: readonly string[]
}

export type Resource = {
  readonly resourceType: string
  readonly id?: string
  readonly meta?: Meta
  readonly [element: string]: Json | undefined
}

export type Reference = {
  readonly reference?: string
  readonly type?: string
  readonly display?: string
}

export type BundleLink = {
  readonly relation: string
  readonly url: string
}

export type BundleEntry = {
  readonly fullUrl?: string
  readonly resource?: Resource
  readonly search?: { readonly mode?: string }
}

export type Bundle = Resource & {
  readonly type?: string
  readonly total?: number
  readonly link?: readonly BundleLink[]
  readonly entry?: readonly BundleEntry[]
}

export type Issue = {
  readonly severity: string
  readonly code: string
  readonly diagnostics?: string
  readonly expression?: readonly string[]
}

export type OperationOutcome = Resource & {
  readonly issue?: readonly Issue[]
}

export function fields(resource: Resource): Readonly<Record<string, Json | undefined>> {
  return resource
}

export function isResource(value: unknown): value is Resource {
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
