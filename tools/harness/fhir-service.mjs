import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { grantScopes } from './issuer.mjs'

const run = promisify(execFile)

const IMAGE = process.env['EXPLORER_SERVICE_IMAGE'] ?? 'fhir-service-service:latest'
const RUNTIME = process.env['EXPLORER_CONTAINER'] ?? 'docker'

async function announced(id) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const { stdout, stderr } = await run(RUNTIME, ['logs', id]).catch(() => ({ stdout: '', stderr: '' }))
    const said = `${stdout}${stderr}`
    const found = /listening on ([0-9.]+:[0-9]+)/.exec(said)

    if (found !== null) {
      return found[1]
    }

    if (/configuration error/.test(said)) {
      throw new Error(said.trim())
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error('the service never announced an address')
}

async function reachable(url, attempts) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const answer = await fetch(url, { signal: AbortSignal.timeout(3000) })

      if (answer.ok) {
        return true
      }
    } catch {
      /* not up yet */
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return false
}

export async function startFhirService(issuer) {
  await grantScopes(issuer, ['user/*.*', 'patient/*.read'])

  const realm = `${issuer.origin}/realms/${issuer.realm}`
  const keys = await (await fetch(`${realm}/protocol/openid-connect/certs`)).text()

  const { stdout } = await run(RUNTIME, [
    'run',
    '-d',
    '--rm',
    '--network=host',
    '-e',
    'FHIR_BIND=127.0.0.1:0',
    '-e',
    `FHIR_AUTH_ISSUER=${realm}`,
    '-e',
    'FHIR_AUTH_AUDIENCE=explorer',
    '-e',
    `FHIR_AUTH_AUTHORIZE=${realm}/protocol/openid-connect/auth`,
    '-e',
    `FHIR_AUTH_TOKEN=${realm}/protocol/openid-connect/token`,
    '-e',
    `FHIR_AUTH_JWKS=${realm}/protocol/openid-connect/certs`,
    '-e',
    `FHIR_AUTH_KEYS=${keys}`,
    '-e',
    'FHIR_AUTH_SCOPES=openid user/*.* patient/*.read',
    IMAGE
  ])

  const id = stdout.trim()
  const stop = async () => {
    await run(RUNTIME, ['rm', '-f', id]).catch(() => undefined)
  }

  try {
    const address = await announced(id)
    const base = `http://${address}`

    if (!(await reachable(`${base}/health`, 30))) {
      throw new Error('the service never answered for its health')
    }

    return { base, stop }
  } catch (cause) {
    await stop()
    throw cause
  }
}

export async function tokenFor(issuer) {
  const answer = await fetch(`${issuer.origin}/realms/${issuer.realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: issuer.clientId,
      username: issuer.username,
      password: issuer.password,
      scope: 'openid user/*.*'
    }).toString()
  })

  const held = await answer.json()

  if (typeof held.access_token !== 'string') {
    throw new Error(`the issuer granted no token: ${JSON.stringify(held)}`)
  }

  return held.access_token
}
