import { httpOverFetch } from '../domain/transport'
import type { Http } from '../domain/transport'
import type { Storage } from '../domain/auth'

export type Environment = {
  readonly now: () => number
  readonly go: (url: string) => void
  readonly replace: (url: string) => void
  readonly setHash: (hash: string) => void
  readonly here: () => URL
  readonly session: Storage
  readonly durable: Storage
  readonly http: Http
  readonly heartbeat: number
}

function memoryStorage(): Storage {
  const kept = new Map<string, string>()

  return {
    getItem: (key) => kept.get(key) ?? null,
    setItem: (key, value) => {
      kept.set(key, value)
    },
    removeItem: (key) => {
      kept.delete(key)
    }
  }
}

function safeStorage(reach: () => Storage | undefined): Storage {
  try {
    return reach() ?? memoryStorage()
  } catch {
    return memoryStorage()
  }
}

export function browserEnvironment(): Environment {
  return {
    now: () => Date.now(),
    go: (url) => {
      globalThis.location.assign(url)
    },
    replace: (url) => {
      globalThis.history.replaceState(null, '', url)
    },
    setHash: (hash) => {
      globalThis.location.hash = hash
    },
    here: () => new URL(globalThis.location.href),
    session: safeStorage(() => globalThis.sessionStorage),
    durable: safeStorage(() => globalThis.localStorage),
    http: httpOverFetch(),
    heartbeat: 15_000
  }
}

export function testEnvironment(over: Partial<Environment> = {}): Environment {
  const gone: string[] = []

  return {
    now: () => 0,
    go: (url) => {
      gone.push(url)
    },
    replace: () => undefined,
    setHash: () => undefined,
    here: () => new URL('http://explorer.example.org/'),
    session: memoryStorage(),
    durable: memoryStorage(),
    http: () => Promise.reject(new Error('no transport was given')),
    heartbeat: 15_000,
    ...over
  }
}
