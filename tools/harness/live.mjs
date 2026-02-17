import { startFront } from './front.mjs'
import { startIssuer } from './issuer.mjs'
import { startService } from './service.mjs'

export async function startLive() {
  const issuer = await startIssuer()
  const service = await startService()
  const front = await startFront(service.base, issuer)

  return {
    base: front.base,
    origin: front.origin,
    issuer,
    stop: async () => {
      await front.stop()
      await service.stop()
      await issuer.stop()
    }
  }
}
