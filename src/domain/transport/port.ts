export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface HttpRequest {
  readonly method: Method
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body?: string
  readonly signal?: AbortSignal
}

export interface HttpResponse {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

export type Http = (request: HttpRequest) => Promise<HttpResponse>
