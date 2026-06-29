import type { Json } from './types'

export type JsonObject = Readonly<Record<string, Json>>;

export function record(value: Json | undefined): JsonObject | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  return value as JsonObject
}

export function list(value: Json | undefined): readonly Json[] {
  return Array.isArray(value) ? (value as readonly Json[]) : []
}

export function text(value: Json | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function scalar(value: Json | undefined): string | undefined {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : undefined
}

export function strings(value: Json | undefined): readonly string[] {
  return list(value).flatMap((item) => (typeof item === 'string' ? [item] : []))
}

export function count(value: Json | undefined): number {
  return typeof value === 'number' ? value : 0
}
