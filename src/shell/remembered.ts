import type { Environment } from './environment'

const BEFORE = 'fhir-explorer.servers'
const REMEMBERED = 6

export function readList(environment: Environment, key: string): readonly string[] {
  const kept = environment.durable.getItem(key)

  if (kept === null) {
    return []
  }

  try {
    const held: unknown = JSON.parse(kept)

    return Array.isArray(held) ? held.filter((one): one is string => typeof one === 'string') : []
  } catch {
    return []
  }
}

export function readBefore(environment: Environment): readonly string[] {
  return readList(environment, BEFORE)
}

function writeBefore(environment: Environment, held: readonly string[]): readonly string[] {
  environment.durable.setItem(BEFORE, JSON.stringify(held))

  return held
}

export function rememberBefore(environment: Environment, address: string): readonly string[] {
  const held = readBefore(environment).filter((one) => one !== address)

  return writeBefore(environment, [address, ...held].slice(0, REMEMBERED))
}

export function forgetBefore(environment: Environment, address: string): readonly string[] {
  return writeBefore(
    environment,
    readBefore(environment).filter((one) => one !== address)
  )
}

