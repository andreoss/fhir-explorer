export type Answer = Readonly<Record<string, string>>

export function answerOf(here: URL): Answer | undefined {
  const params = new URLSearchParams(here.search)
  const carried = params.has('code') || params.has('error')

  if (!carried) {
    return undefined
  }

  return Object.fromEntries(params.entries())
}

export function withoutAnswer(here: URL): string {
  return `${here.origin}${here.pathname}${here.hash}`
}
