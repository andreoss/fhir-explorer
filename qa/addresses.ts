import { readFileSync } from 'node:fs'
import { ADDRESSES } from './setup'

export type Addresses = {
  readonly app: string
  readonly fhir: string
  readonly service: string
  readonly proxied: boolean
  readonly browser: string
  readonly user: string
  readonly password: string
  readonly made: Readonly<Record<string, string>>
}

export function addresses(): Addresses {
  return JSON.parse(readFileSync(ADDRESSES, 'utf8')) as Addresses
}

export function remoteBrowser(): { readonly wsEndpoint: string } | undefined {
  try {
    return { wsEndpoint: addresses().browser }
  } catch {
    return undefined
  }
}
