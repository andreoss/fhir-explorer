import type { Http } from '../transport/port'
import type { Clock, Pending, Session } from './launch'
import { refresh } from './launch'

export type PendingStore = {
  save: (pending: Pending) => void
  read: () => Pending | undefined
  clear: () => void
}

export type Storage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type Renewed =
  | { readonly ok: true }
  | { readonly ok: false; readonly relaunch: boolean; readonly returnTo: string; readonly message: string }

export type Held = {
  token: () => string | undefined
  session: () => Session | undefined
  pending: () => Pending | undefined
  expired: () => boolean
  begin: (pending: Pending) => void
  hold: (session: Session) => void
  renew: (http: Http) => Promise<Renewed>
  clear: () => void
}

const KEY = 'fhir-explorer.launch'
const SKEW = 60_000

export function memoryPending(): PendingStore {
  let kept: Pending | undefined

  return {
    save: (pending) => {
      kept = pending
    },
    read: () => kept,
    clear: () => {
      kept = undefined
    }
  }
}

export function storedPending(storage: Storage): PendingStore {
  return {
    save: (pending) => {
      storage.setItem(KEY, JSON.stringify(pending))
    },
    read: () => {
      const kept = storage.getItem(KEY)

      if (kept === null) {
        return undefined
      }

      try {
        return JSON.parse(kept) as Pending
      } catch {
        return undefined
      }
    },
    clear: () => {
      storage.removeItem(KEY)
    }
  }
}

export function createSession(store: PendingStore, now: Clock): Held {
  let held: Session | undefined

  return {
    token: () => held?.accessToken,
    session: () => held,
    pending: () => store.read(),
    expired: () => held !== undefined && held.expiresAt - SKEW <= now(),

    begin: (pending) => {
      store.save(pending)
    },

    hold: (session) => {
      held = session
    },

    renew: async (http) => {
      const pending = store.read()

      if (held === undefined || pending === undefined) {
        return { ok: false, relaunch: true, returnTo: pending?.returnTo ?? '', message: 'no launch to renew' }
      }

      const renewed = await refresh(held, pending, http, now)

      if (!renewed.ok) {
        held = undefined

        return { ok: false, relaunch: true, returnTo: pending.returnTo, message: renewed.error.message }
      }

      held = renewed.value

      return { ok: true }
    },

    clear: () => {
      held = undefined
      store.clear()
    }
  }
}
