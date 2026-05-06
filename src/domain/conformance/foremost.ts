import type { SearchParam } from './capability'

type Rank = {
  readonly own: number
  readonly hyphens: number
  readonly length: number
  readonly name: string
}

function rank(parameter: SearchParam): Rank {
  return {
    own: parameter.name.startsWith('_') ? 1 : 0,
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
