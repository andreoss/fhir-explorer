import { describe, expect, it } from 'vitest'
import { en } from './en'
import { catalogueFor, catalogues, languages } from './index'

describe('the catalogues', () => {
  it('carry the same keys, every one of them', () => {
    const wanted = Object.keys(en).sort()

    for (const [language, catalogue] of Object.entries(catalogues)) {
      expect({ language, keys: Object.keys(catalogue).sort() }).toEqual({ language, keys: wanted })
    }
  })

  it('leave nothing blank', () => {
    for (const [language, catalogue] of Object.entries(catalogues)) {
      for (const [key, said] of Object.entries(catalogue)) {
        expect({ language, key, empty: said.trim().length === 0 }).toEqual({ language, key, empty: false })
      }
    }
  })

  it('say which way each of them reads', () => {
    for (const catalogue of Object.values(catalogues)) {
      expect(['ltr', 'rtl']).toContain(catalogue.direction)
    }
  })

  it('answer for a language they carry, and fall back for one they do not', () => {
    expect(catalogueFor('ru').name).toBe('Русский')
    expect(catalogueFor('xx')).toBe(en)
    expect(languages()).toContain('ru')
  })
})
