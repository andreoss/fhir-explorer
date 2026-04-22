import { createEffect } from 'solid-js'

export const NAME = 'FHIR Explorer'

export function useTitle(said: () => string): void {
  createEffect(() => {
    const held = said().trim()

    globalThis.document.title = held.length > 0 ? `${held} · ${NAME}` : NAME
  })
}
