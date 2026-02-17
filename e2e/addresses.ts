import { readFileSync } from 'node:fs'
import { ADDRESSES } from './setup'

export type Addresses = {
  readonly app: string
  readonly fhir: string
  readonly user: string
  readonly password: string
  readonly client: string
}

export function addresses(): Addresses {
  return JSON.parse(readFileSync(ADDRESSES, 'utf8')) as Addresses
}
