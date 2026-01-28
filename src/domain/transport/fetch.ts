import type { Http } from './port'

export function httpOverFetch(send: typeof fetch = globalThis.fetch.bind(globalThis)): Http {
  return async (request) => {
    const answer = await send(request.url, {
      method: request.method,
      headers: { ...request.headers },
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(request.signal === undefined ? {} : { signal: request.signal })
    })

    const headers: Record<string, string> = {}

    answer.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value
    })

    return { status: answer.status, headers, body: await answer.text() }
  }
}
