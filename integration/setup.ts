import { startLive } from '../tools/harness/live.mjs'

export default async function start(): Promise<() => Promise<void>> {
  const live = await startLive()

  process.env.EXPLORER_LIVE_BASE = live.base
  process.env.EXPLORER_LIVE_CLIENT = live.issuer.clientId
  process.env.EXPLORER_LIVE_USER = live.issuer.username
  process.env.EXPLORER_LIVE_PASSWORD = live.issuer.password

  return async () => {
    await live.stop()
  }
}
