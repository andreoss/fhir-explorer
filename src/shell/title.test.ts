import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { NAME, useTitle } from './title'

async function settled(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

describe('what the tab says', () => {
  it('names the page and what it belongs to', async () => {
    const stop = createRoot((dispose) => {
      useTitle(() => 'Patient')

      return dispose
    })

    await settled()

    expect(document.title).toBe(`Patient · ${NAME}`)
    stop()
  })

  it('names only what it belongs to where a page has no name', async () => {
    const stop = createRoot((dispose) => {
      useTitle(() => '   ')

      return dispose
    })

    await settled()

    expect(document.title).toBe(NAME)
    stop()
  })
})
