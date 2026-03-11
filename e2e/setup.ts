import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { startApp } from '../tools/harness/app.mjs'
import { startBrowser } from '../tools/harness/browser.mjs'
import { startFront } from '../tools/harness/front.mjs'
import { startIssuer } from '../tools/harness/issuer.mjs'
import { startService } from '../tools/harness/service.mjs'

export const ADDRESSES = 'scratch/e2e.json'
const STACK = 'scratch/e2e-stack.json'

type Issuer = {
  readonly origin: string
  readonly realm: string
  readonly clientId: string
  readonly username: string
  readonly password: string
  readonly authorize: string
  readonly token: string
  readonly userinfo: string
}

type Stack = {
  readonly service: string
  readonly browser: string
  readonly issuer: Issuer
}

async function containers(): Promise<{ readonly stack: Stack; readonly stop: () => Promise<void> }> {
  const kept = process.env.EXPLORER_REUSE !== undefined && existsSync(STACK)

  if (kept) {
    return { stack: JSON.parse(readFileSync(STACK, 'utf8')) as Stack, stop: () => Promise.resolve() }
  }

  const browser = await startBrowser()
  const issuer = (await startIssuer()) as Issuer & { readonly stop: () => Promise<void> }
  const service = await startService()

  return {
    stack: {
      service: service.base,
      browser: browser.endpoint,
      issuer: {
        origin: issuer.origin,
        realm: issuer.realm,
        clientId: issuer.clientId,
        username: issuer.username,
        password: issuer.password,
        authorize: issuer.authorize,
        token: issuer.token,
        userinfo: issuer.userinfo
      }
    },
    stop: async () => {
      await service.stop()
      await issuer.stop()
      await browser.stop()
    }
  }
}

export default async function start(): Promise<() => Promise<void>> {
  const held = await containers()
  const front = await startFront(held.stack.service, held.stack.issuer)
  const app = await startApp()

  mkdirSync('scratch', { recursive: true })
  writeFileSync(STACK, JSON.stringify(held.stack))
  writeFileSync(
    ADDRESSES,
    JSON.stringify({
      app: app.url,
      fhir: front.base,
      browser: held.stack.browser,
      user: held.stack.issuer.username,
      password: held.stack.issuer.password,
      client: held.stack.issuer.clientId
    })
  )

  return async () => {
    await app.stop()
    await front.stop()

    if (process.env.EXPLORER_KEEP === undefined) {
      await held.stop()
    }
  }
}
