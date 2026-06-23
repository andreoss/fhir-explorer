import type { Bundle, Resource } from '../fhir'
import type { Failure, Result } from './outcome'
import { failed, ok, parseResource, payloadFailure, statusFailure, transportFailure } from './outcome'
import type { Http, HttpRequest, Method } from './port'

export type Envelope<T extends Resource = Resource> = {
  readonly resource: T
  readonly versionId?: string
  readonly lastModified?: string
  readonly location?: string
}

export type Call = {
  readonly signal?: AbortSignal
}

export type Guard = {
  readonly versionId?: string
}

export type SearchParams = readonly (readonly [string, string])[]

export type ClientOptions = {
  readonly base: string
  readonly http: Http
  readonly token?: () => string | undefined
}

export type Client = {
  readonly base: string
  read: (type: string, id: string, call?: Call) => Promise<Result<Envelope>>
  vread: (type: string, id: string, versionId: string, call?: Call) => Promise<Result<Envelope>>
  search: (type: string, params: SearchParams, call?: Call) => Promise<Result<Envelope<Bundle>>>
  history: (type: string, id: string, call?: Call) => Promise<Result<Envelope<Bundle>>>
  follow: (url: string, call?: Call) => Promise<Result<Envelope<Bundle>>>
  create: (resource: Resource, call?: Call) => Promise<Result<Envelope>>
  update: (resource: Resource, guard?: Guard, call?: Call) => Promise<Result<Envelope>>
  remove: (type: string, id: string, call?: Call) => Promise<Result<Envelope | undefined>>
  fetch: (request: Omit<HttpRequest, 'headers'> & { headers?: Readonly<Record<string, string>> }) => Promise<
    Result<Envelope>
  >
}

const MEDIA = 'application/fhir+json'

function versionOf(headers: Readonly<Record<string, string>>): string | undefined {
  const tag = headers.etag

  if (tag === undefined) {
    return undefined
  }

  return /"(.+)"/.exec(tag)?.[1]
}

function queryOf(params: SearchParams): string {
  const query = params.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join('&')

  return query.length > 0 ? `?${query}` : ''
}

export function createClient(options: ClientOptions): Client {
  const base = options.base.replace(/\/+$/, '')

  async function send(
    method: Method,
    url: string,
    call: Call | undefined,
    body: Resource | undefined,
    extra: Readonly<Record<string, string>>
  ): Promise<Result<Envelope | undefined>> {
    const token = options.token?.()
    const headers: Record<string, string> = { accept: MEDIA, ...extra }

    if (token !== undefined) {
      headers.authorization = `Bearer ${token}`
    }

    if (body !== undefined) {
      headers['content-type'] = MEDIA
    }

    let answer

    try {
      answer = await options.http({
        method,
        url,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(call?.signal === undefined ? {} : { signal: call.signal })
      })
    } catch (cause) {
      return failed(transportFailure(cause))
    }

    if (answer.status >= 400) {
      return failed(statusFailure(answer.status, answer.body))
    }

    const envelope = envelopeOf(answer.headers, answer.body)

    if (envelope === undefined && answer.body.trim().length > 0) {
      return failed(payloadFailure('the server answered something that is not a resource'))
    }

    return ok(envelope)
  }

  function envelopeOf(headers: Readonly<Record<string, string>>, body: string): Envelope | undefined {
    const resource = parseResource(body)

    if (resource === undefined) {
      return undefined
    }

    const version = versionOf(headers) ?? resource.meta?.versionId
    const modified = headers['last-modified']
    const location = headers.location ?? headers['content-location']

    return {
      resource,
      ...(version === undefined ? {} : { versionId: version }),
      ...(modified === undefined ? {} : { lastModified: modified }),
      ...(location === undefined ? {} : { location })
    }
  }

  function required(result: Result<Envelope | undefined>): Result<Envelope> {
    if (!result.ok) {
      return result
    }

    if (result.value === undefined) {
      return failed<Envelope>(payloadFailure('the server answered with no resource'))
    }

    return ok(result.value)
  }

  function bundled(result: Result<Envelope | undefined>): Result<Envelope<Bundle>> {
    const single = required(result)

    if (!single.ok) {
      return single
    }

    if (single.value.resource.resourceType !== 'Bundle') {
      return failed<Envelope<Bundle>>(payloadFailure('the server answered a single resource where a set was asked for'))
    }

    return ok(single.value as Envelope<Bundle>)
  }

  async function get(url: string, call: Call | undefined): Promise<Result<Envelope | undefined>> {
    return send('GET', url, call, undefined, {})
  }

  return {
    base,

    read: async (type, id, call) => required(await get(`${base}/${type}/${id}`, call)),

    vread: async (type, id, versionId, call) =>
      required(await get(`${base}/${type}/${id}/_history/${versionId}`, call)),

    search: async (type, params, call) => bundled(await get(`${base}/${type}${queryOf(params)}`, call)),

    history: async (type, id, call) => bundled(await get(`${base}/${type}/${id}/_history`, call)),

    follow: async (url, call) => bundled(await get(url, call)),

    create: async (resource, call) => required(await send('POST', `${base}/${resource.resourceType}`, call, resource, {})),

    update: async (resource, guard, call) =>
      required(
        await send(
          'PUT',
          `${base}/${resource.resourceType}/${resource.id ?? ''}`,
          call,
          resource,
          guard?.versionId === undefined ? {} : { 'if-match': `W/"${guard.versionId}"` }
        )
      ),

    remove: async (type, id, call) => send('DELETE', `${base}/${type}/${id}`, call, undefined, {}),

    fetch: async (request) =>
      required(
        await send(
          request.method,
          request.url,
          request.signal === undefined ? undefined : { signal: request.signal },
          undefined,
          request.headers ?? {}
        )
      )
  }
}

export type { Failure }
