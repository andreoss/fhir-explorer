import type { Bundle, Resource } from '@lib/fhir'

export function linkOf(bundle: Bundle, relation: string): string | undefined {
  return bundle.link?.find((link) => link.relation === relation)?.url
}

export function entriesOf(bundle: Bundle): readonly Resource[] {
  return (bundle.entry ?? []).flatMap((entry) => (entry.resource === undefined ? [] : [entry.resource]))
}

export function totalOf(bundle: Bundle): number | undefined {
  return bundle.total
}
