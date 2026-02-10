import type { Http, HttpRequest, HttpResponse } from '../domain/transport/port'

export type Recorded = {
  readonly requests: HttpRequest[]
  readonly http: Http
}

export function stubHttp(answers: (HttpResponse | Error)[]): Recorded {
  const requests: HttpRequest[] = []
  const queue = [...answers]

  const http: Http = (request) => {
    requests.push(request)
    const answer = queue.shift()

    if (answer === undefined) {
      return Promise.reject(new Error(`no answer for ${request.method} ${request.url}`))
    }

    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
  }

  return { requests, http }
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse {
  return {
    status,
    headers: { 'content-type': 'application/fhir+json', ...headers },
    body: JSON.stringify(body)
  }
}

export function empty(status: number, headers: Record<string, string> = {}): HttpResponse {
  return { status, headers, body: '' }
}
