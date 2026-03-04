import type { ServerCapability } from '../conformance/capability'

export type Question = {
  readonly type: string
  readonly parameter: string
}

export function questionsFor(capability: ServerCapability, target: string): readonly Question[] {
  return capability.types.flatMap((entry) =>
    entry.searchParams
      .filter((parameter) => parameter.type === 'reference')
      .map((parameter) => ({ type: entry.type, parameter: parameter.name }))
      .filter(() => entry.interactions.includes('search-type'))
      .map((question) => ({ ...question, target }))
      .map(({ type, parameter }) => ({ type, parameter }))
  )
}
