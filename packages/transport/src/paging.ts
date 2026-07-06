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

export function followed(base: string, said: string): string {
  const mine = new URL(base)
  const link = new URL(said, `${base}/`)

  if (link.origin === mine.origin) {
    return link.href
  }

  const segments = link.pathname.split('/').filter((one) => one.length > 0)
  const at = segments.findIndex((one) => /^[A-Z]/.test(one))
  const tail = at < 0 ? '' : `/${segments.slice(at).join('/')}`

  return `${base}${tail}${link.search}`
}
