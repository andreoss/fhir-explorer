import { en } from './en'
import type { Catalogue, TextKey } from './en'
import { ru } from './ru'

export type { Catalogue, TextKey }

export const catalogues: Readonly<Record<string, Catalogue>> = { en, ru }

export function catalogueFor(language: string): Catalogue {
  return catalogues[language] ?? en
}

export function languages(): readonly string[] {
  return Object.keys(catalogues)
}
