import type { Issue, Resource } from '../fhir/types'
import { isOutcome, isResource } from '../fhir/types'

export type FailureKind = 'transport' | 'cancelled' | 'timeout' | 'status' | 'payload'

export type Failure = {
  readonly kind: FailureKind
  readonly message: string
  readonly status?: number
  readonly issues: readonly Issue[]
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: Failure }

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function failed<T>(error: Failure): Result<T> {
  return { ok: false, error }
}

export function parseResource(body: string): Resource | undefined {
  try {
    const parsed: unknown = JSON.parse(body)
    return isResource(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function issuesOf(resource: Resource | undefined): readonly Issue[] {
  if (resource === undefined || !isOutcome(resource)) {
    return []
  }

  return resource.issue ?? []
}

export function describeIssues(issues: readonly Issue[], fallback: string): string {
  const said = issues
    .map((issue) => issue.diagnostics ?? issue.code)
    .filter((text) => text.length > 0)
    .join('; ')

  return said.length > 0 ? said : fallback
}

export function statusFailure(status: number, body: string): Failure {
  const issues = issuesOf(parseResource(body))

  return {
    kind: 'status',
    status,
    issues,
    message: describeIssues(issues, `the server answered ${String(status)}`)
  }
}

function kindOf(error: Error): FailureKind {
  if (error.name === 'TimeoutError') {
    return 'timeout'
  }

  return error.name === 'AbortError' ? 'cancelled' : 'transport'
}

export function transportFailure(cause: unknown): Failure {
  const error = cause instanceof Error ? cause : new Error(String(cause))
  const kind = kindOf(error)

  return {
    kind,
    issues: [],
    message: kind === 'timeout' ? 'the server did not answer in time' : error.message
  }
}

export function payloadFailure(message: string): Failure {
  return { kind: 'payload', issues: [], message }
}
