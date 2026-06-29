import type { Http } from './port'

export const PATIENCE = 30_000

function within(patience: number, asked: AbortSignal | undefined): AbortSignal {
  const own = AbortSignal.timeout(patience)

  return asked === undefined ? own : AbortSignal.any([own, asked])
}

export function httpOverFetch(
  send: typeof fetch = globalThis.fetch.bind(globalThis),
  patience = PATIENCE
): Http {
  return async (request) => {
    const answer = await send(request.url, {
      method: request.method,
      cache: 'no-store',
      headers: { ...request.headers },
      ...(request.body === undefined ? {} : { body: request.body }),
      signal: within(patience, request.signal)
    })

    const headers: Record<string, string> = {}

    answer.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value
    })

    return { status: answer.status, headers, body: await answer.text() }
  }
}
