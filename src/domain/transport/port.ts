export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export type HttpRequest = {
  readonly method: Method
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body?: string
  readonly signal?: AbortSignal
}

export type HttpResponse = {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

export type Http = (request: HttpRequest) => Promise<HttpResponse>
