import type { ServerCapability } from '../conformance/capability'

export type Question = {
  readonly type: string
  readonly parameter: string
}

export type Asking = {
  readonly type: string
  readonly parameters: readonly string[]
}

export function askingFor(capability: ServerCapability): readonly Asking[] {
  return capability.types
    .filter((entry) => entry.interactions.includes('search-type'))
    .flatMap((entry) => {
      const parameters = entry.searchParams
        .filter((parameter) => parameter.type === 'reference')
        .map((parameter) => parameter.name)

      return parameters.length === 0 ? [] : [{ type: entry.type, parameters }]
    })
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
