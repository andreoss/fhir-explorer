import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

const IMAGE = process.env.EXPLORER_ISSUER_IMAGE ?? 'quay.io/keycloak/keycloak:latest'
const RUNTIME = process.env.EXPLORER_CONTAINER ?? 'docker'
const REALM = 'explorer'

async function announcedPort(id) {
  const { stdout } = await run(RUNTIME, ['port', id])
  const found = /:(\d+)\s*$/m.exec(stdout.trim())

  if (found === null) {
    throw new Error(`the issuer announced no address: ${stdout}`)
  }

  return Number(found[1])
}

async function reachable(url, attempts) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const answer = await fetch(url, { signal: AbortSignal.timeout(3000) })

      if (answer.ok) {
        return true
      }
    } catch {
      /* the issuer is not up yet */
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return false
}

export async function startIssuer() {
  const realm = fileURLToPath(new URL('realm.json', import.meta.url))
  const { stdout } = await run(RUNTIME, [
    'run',
    '-d',
    '--rm',
    '-p',
    '127.0.0.1::8080',
    '-e',
    'KC_BOOTSTRAP_ADMIN_USERNAME=admin',
    '-e',
    'KC_BOOTSTRAP_ADMIN_PASSWORD=admin',
    '-v',
    `${realm}:/opt/keycloak/data/import/realm.json:ro`,
    IMAGE,
    'start-dev',
    '--import-realm'
  ])

  const id = stdout.trim()
  const port = await announcedPort(id)
  const origin = `http://127.0.0.1:${String(port)}`
  const discovery = `${origin}/realms/${REALM}/.well-known/openid-configuration`

  if (!(await reachable(discovery, 90))) {
    await run(RUNTIME, ['rm', '-f', id]).catch(() => undefined)
    throw new Error('the issuer never answered for its own discovery document')
  }

  const document = await (await fetch(discovery)).json()

  return {
    origin,
    realm: REALM,
    clientId: 'explorer',
    username: 'explorer',
    password: 'explorer',
    authorize: document.authorization_endpoint,
    token: document.token_endpoint,
    userinfo: document.userinfo_endpoint,
    stop: async () => {
      await run(RUNTIME, ['rm', '-f', id]).catch(() => undefined)
    }
  }
}

async function adminToken(origin) {
  const answer = await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', connection: 'close' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: 'admin',
      password: 'admin'
    }).toString(),
    signal: AbortSignal.timeout(15_000)
  })

  const held = await answer.json()

  if (typeof held.access_token !== 'string') {
    throw new Error(`the issuer granted no administration token: ${JSON.stringify(held)}`)
  }

  return held.access_token
}

export async function grantScopes(issuer, scopes) {
  const token = await adminToken(issuer.origin)
  const admin = `${issuer.origin}/admin/realms/${issuer.realm}`
  const ask = (path, init = {}) =>
    fetch(`${admin}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        connection: 'close',
        ...(init.headers ?? {})
      },
      signal: AbortSignal.timeout(15_000)
    })

  const clients = await (await ask(`/clients?clientId=${encodeURIComponent(issuer.clientId)}`)).json()
  const client = clients[0]

  if (client === undefined) {
    throw new Error('the issuer knows no such client')
  }

  for (const scope of scopes) {
    const made = await ask('/client-scopes', {
      method: 'POST',
      body: JSON.stringify({
        name: scope,
        protocol: 'openid-connect',
        attributes: { 'include.in.token.scope': 'true', 'display.on.consent.screen': 'false' }
      })
    })

    if (!made.ok && made.status !== 409) {
      throw new Error(`the scope ${scope} was refused with ${String(made.status)}`)
    }

    const held = await (await ask(`/client-scopes`)).json()
    const found = held.find((one) => one.name === scope)

    if (found === undefined) {
      throw new Error(`the issuer did not keep the scope ${scope}`)
    }

    const attached = await ask(`/clients/${client.id}/default-client-scopes/${found.id}`, { method: 'PUT' })

    if (!attached.ok && attached.status !== 409) {
      throw new Error(`the scope ${scope} was not attached: ${String(attached.status)}`)
    }
  }
}
