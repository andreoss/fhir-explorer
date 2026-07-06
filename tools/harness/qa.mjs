import { startApp } from './app.mjs'
import { startBrowser } from './browser.mjs'
import { startCorsFront } from './cors-front.mjs'
import { startFhirService, tokenFor } from './fhir-service.mjs'
import { startIssuer } from './issuer.mjs'
import { populate } from './populated.mjs'
import { seed } from './simulated.mjs'

/** @returns {Promise<{app: string, fhir: string, service: string, proxied: boolean, browser: string, issuer: {origin: string, realm: string, clientId: string, username: string, password: string}, made: Record<string, string>, many: {sites: number, doctors: number, patients: number, encounters: number, observations: number} | undefined, stop: () => Promise<void>}>} */
export async function startQa() {
  const browser = await startBrowser()
  const issuer = await startIssuer()
  const service = await startFhirService(issuer)
  const token = await tokenFor(issuer)
  const made = await seed(service.base, token)
  const many =
    process.env.EXPLORER_POPULATE === undefined
      ? undefined
      : await populate(service.base, token, (said) => {
          process.stdout.write(`  ${said}
`)
        })
  const front = process.env.EXPLORER_DIRECT === undefined ? await startCorsFront(service.base) : undefined
  const app = await startApp()

  return {
    app: app.url,
    fhir: front?.base ?? service.base,
    service: service.base,
    proxied: front !== undefined,
    browser: browser.endpoint,
    issuer,
    made: Object.fromEntries(made),
    many,
    stop: async () => {
      await app.stop()
      await front?.stop()
      await service.stop()
      await issuer.stop()
      await browser.stop()
    }
  }
}
