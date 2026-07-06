import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { startApp } from '../tools/harness/app.mjs'
import { startCorsFront } from '../tools/harness/cors-front.mjs'
import { startQa } from '../tools/harness/qa.mjs'

export const ADDRESSES = 'scratch/qa.json'

type Kept = {
  readonly service: string
  readonly proxied: boolean
  readonly browser: string
  readonly user: string
  readonly password: string
  readonly made: Readonly<Record<string, string>>
  readonly many?: Readonly<Record<string, number>>
}

export default async function start(): Promise<() => Promise<void>> {
  if (process.env.EXPLORER_REUSE !== undefined && existsSync(ADDRESSES)) {
    const kept = JSON.parse(readFileSync(ADDRESSES, 'utf8')) as Kept
    const front = kept.proxied ? await startCorsFront(kept.service) : undefined
    const app = await startApp()

    writeFileSync(
      ADDRESSES,
      JSON.stringify({ ...kept, app: app.url, fhir: front?.base ?? kept.service }, null, 2)
    )

    return async () => {
      await app.stop()
      await front?.stop()
    }
  }

  const qa = await startQa()

  mkdirSync('scratch', { recursive: true })
  mkdirSync('doc/qa/screenshots', { recursive: true })
  writeFileSync(
    ADDRESSES,
    JSON.stringify(
      {
        app: qa.app,
        fhir: qa.fhir,
        service: qa.service,
        proxied: qa.proxied,
        browser: qa.browser,
        user: qa.issuer.username,
        password: qa.issuer.password,
        made: qa.made,
        many: qa.many
      },
      null,
      2
    )
  )

  if (process.env.EXPLORER_KEEP !== undefined) {
    return () => Promise.resolve()
  }

  return async () => {
    await qa.stop()
  }
}
