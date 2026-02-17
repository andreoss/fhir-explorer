import { createServer } from 'node:http'

function send(answer, status, body, headers = {}) {
  answer.writeHead(status, { 'access-control-allow-origin': '*', ...headers })
  answer.end(body)
}

function sendJson(answer, status, body) {
  send(answer, status, JSON.stringify(body), { 'content-type': 'application/json' })
}

async function readBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString()
}

export async function startFront(service, issuer) {
  const known = new Map()

  const server = createServer((request, answer) => {
    void handle(request, answer).catch((cause) => {
      sendJson(answer, 500, { error: String(cause) })
    })
  })

  const origin = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${String(server.address().port)}`)
    })
  })

  async function accepted(carried) {
    if (!carried.startsWith('Bearer ')) {
      return false
    }

    const token = carried.slice('Bearer '.length)
    const seen = known.get(token)

    if (seen !== undefined && seen > Date.now()) {
      return true
    }

    const answer = await fetch(issuer.userinfo, { headers: { authorization: carried } })

    if (!answer.ok) {
      return false
    }

    known.set(token, Date.now() + 30_000)

    return true
  }

  async function handle(request, answer) {
    const url = new URL(request.url, origin)

    if (request.method === 'OPTIONS') {
      send(answer, 204, '', {
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type, accept, if-match, if-none-match, prefer',
        'access-control-expose-headers': 'etag, location, content-location, last-modified'
      })
      return
    }

    if (url.pathname === '/fhir/.well-known/smart-configuration') {
      sendJson(answer, 200, {
        issuer: `${issuer.origin}/realms/${issuer.realm}`,
        authorization_endpoint: issuer.authorize,
        token_endpoint: issuer.token,
        scopes_supported: ['openid', 'profile', 'email'],
        capabilities: ['launch-standalone', 'client-public'],
        code_challenge_methods_supported: ['S256']
      })
      return
    }

    if (!url.pathname.startsWith('/fhir')) {
      send(answer, 404, '')
      return
    }

    if (!(await accepted(request.headers.authorization ?? ''))) {
      sendJson(answer, 401, {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'login', diagnostics: 'this request carried no session the issuer knows' }]
      })
      return
    }

    const target = `${service}${url.pathname.replace(/^\/fhir/, '')}${url.search}`
    const body = request.method === 'GET' || request.method === 'DELETE' ? undefined : await readBody(request)
    const forwarded = await fetch(target, {
      method: request.method,
      headers: {
        accept: request.headers.accept ?? 'application/fhir+json',
        ...(request.headers['content-type'] === undefined
          ? {}
          : { 'content-type': request.headers['content-type'] }),
        ...(request.headers['if-match'] === undefined ? {} : { 'if-match': request.headers['if-match'] }),
        ...(request.headers['if-none-match'] === undefined
          ? {}
          : { 'if-none-match': request.headers['if-none-match'] })
      },
      ...(body === undefined ? {} : { body })
    })

    const text = await forwarded.text()
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'etag, location, content-location, last-modified'
    }

    for (const name of ['content-type', 'etag', 'location', 'content-location', 'last-modified']) {
      const value = forwarded.headers.get(name)

      if (value !== null) {
        headers[name] = value
      }
    }

    send(answer, forwarded.status, text, headers)
  }

  return {
    origin,
    base: `${origin}/fhir`,
    stop: async () => {
      await new Promise((resolve) => {
        server.close(() => {
          resolve()
        })
      })
    }
  }
}
