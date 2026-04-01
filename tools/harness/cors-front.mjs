import { createServer } from 'node:http'

const HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'etag, location, content-location, last-modified'
}

async function readBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

/** @returns {Promise<{base: string, stop: () => Promise<void>}>} */
export async function startCorsFront(service) {
  const server = createServer((request, answer) => {
    void handle(request, answer).catch((cause) => {
      answer.writeHead(502, { 'content-type': 'application/json', ...HEADERS })
      answer.end(JSON.stringify({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: String(cause) }] }))
    })
  })

  const origin = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${String(server.address().port)}`)
    })
  })

  async function handle(request, answer) {
    if (request.method === 'OPTIONS') {
      answer.writeHead(204, {
        ...HEADERS,
        'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type, accept, if-match, if-none-match, prefer',
        'access-control-max-age': '600'
      })
      answer.end()
      return
    }

    const body = request.method === 'GET' || request.method === 'DELETE' ? undefined : await readBody(request)
    const carried = {}

    for (const name of ['authorization', 'accept', 'content-type', 'if-match', 'if-none-match', 'prefer']) {
      const value = request.headers[name]

      if (typeof value === 'string') {
        carried[name] = value
      }
    }

    const forwarded = await fetch(`${service}${request.url}`, {
      method: request.method,
      headers: { ...carried, connection: 'close' },
      ...(body === undefined || body.length === 0 ? {} : { body }),
      signal: AbortSignal.timeout(30_000)
    })

    const text = await forwarded.text()
    const headers = { ...HEADERS }

    for (const name of ['content-type', 'etag', 'location', 'content-location', 'last-modified']) {
      const value = forwarded.headers.get(name)

      if (value !== null) {
        headers[name] = value
      }
    }

    answer.writeHead(forwarded.status, headers)
    answer.end(text)
  }

  return {
    base: origin,
    stop: async () => {
      await new Promise((resolve) => {
        server.close(() => {
          resolve()
        })
      })
    }
  }
}
