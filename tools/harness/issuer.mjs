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
