import type { Http, HttpResponse } from './port'

export type Entry = {
  readonly etag: string
  readonly response: HttpResponse
}

export type Store = {
  get: (key: string) => Entry | undefined
  set: (key: string, entry: Entry) => void
  drop: (key: string) => void
}

export function createStore(): Store {
  const entries = new Map<string, Entry>()

  return {
    get: (key) => entries.get(key),
    set: (key, entry) => {
      entries.set(key, entry)
    },
    drop: (key) => {
      entries.delete(key)
    }
  }
}

export function cachingHttp(inner: Http, store: Store): Http {
  return async (request) => {
    if (request.method !== 'GET') {
      store.drop(request.url)
      return inner(request)
    }

    const kept = store.get(request.url)
    const asked = request.headers['if-none-match'] !== undefined
    const answer = await inner(
      kept === undefined || asked ? request : { ...request, headers: { ...request.headers, 'if-none-match': kept.etag } }
    )

    if (answer.status === 304 && kept !== undefined && !asked) {
      return kept.response
    }

    const etag = answer.headers.etag

    if (answer.status === 200 && etag !== undefined) {
      store.set(request.url, { etag, response: answer })
    }

    return answer
  }
}
