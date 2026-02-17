import { mkdirSync, writeFileSync } from 'node:fs'
import { startApp } from '../tools/harness/app.mjs'
import { startLive } from '../tools/harness/live.mjs'

export const ADDRESSES = 'scratch/e2e.json'

export default async function start(): Promise<() => Promise<void>> {
  const live = await startLive()
  const app = await startApp()

  mkdirSync('scratch', { recursive: true })
  writeFileSync(
    ADDRESSES,
    JSON.stringify({
      app: app.url,
      fhir: live.base,
      user: live.issuer.username,
      password: live.issuer.password,
      client: live.issuer.clientId
    })
  )

  return async () => {
    await app.stop()
    await live.stop()
  }
}
