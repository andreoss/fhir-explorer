import type { SearchParam } from './capability'

const PLAINEST: Readonly<Record<string, number>> = {
  string: 0,
  token: 0,
  date: 1,
  number: 2,
  quantity: 2,
  reference: 3,
  uri: 3,
  composite: 4,
  special: 4
}

type Rank = {
  readonly own: number
  readonly kind: number
  readonly hyphens: number
  readonly length: number
  readonly name: string
}

function rank(parameter: SearchParam): Rank {
  return {
    own: parameter.name.startsWith('_') ? 1 : 0,
    kind: PLAINEST[parameter.type] ?? 3,
    hyphens: parameter.name.split('-').length - 1,
    length: parameter.name.length,
    name: parameter.name
  }
}

function before(left: SearchParam, right: SearchParam): number {
  const one = rank(left)
  const other = rank(right)

  return (
    one.own - other.own ||
    one.kind - other.kind ||
    one.hyphens - other.hyphens ||
    one.length - other.length ||
    one.name.localeCompare(other.name)
  )
}

export function foremostOf(parameters: readonly SearchParam[], many: number): readonly SearchParam[] {
  return [...parameters].sort(before).slice(0, many)
}

export function restOf(parameters: readonly SearchParam[], many: number): readonly SearchParam[] {
  const shown = new Set(foremostOf(parameters, many).map((one) => one.name))

  return parameters.filter((one) => !shown.has(one.name))
}
