import { For } from "solid-js";
import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { TroubleProvider, useTroubles } from './errors'

function Surface() {
  const troubles = useTroubles()

  return (
    <div>
      <button onClick={() => { troubles.report('the server', 'it refused') }}>report</button>
      <button onClick={() => { troubles.dismiss(troubles.all()[0]?.id ?? 0) }}>dismiss</button>
      <ul>
        <For each={troubles.all()}>{(trouble) => (
          <li>
            {trouble.at}: {trouble.message}
          </li>
        )}</For>
      </ul>
    </div>
  )
}

describe('error surface', () => {
  it('shows what failed and where', async () => {
    const screen = render(() => (
      <TroubleProvider>
        <Surface />
      </TroubleProvider>
    ))

    screen.getByText('report').click()

    expect(await screen.findByText('the server: it refused')).toBeInTheDocument()
  })

  it('lets what failed be dismissed', async () => {
    const screen = render(() => (
      <TroubleProvider>
        <Surface />
      </TroubleProvider>
    ))

    screen.getByText('report').click()
    await screen.findByText('the server: it refused')
    screen.getByText('dismiss').click()

    expect(screen.queryByText('the server: it refused')).not.toBeInTheDocument()
  })

  it('refuses to be used without a surface in scope', () => {
    expect(() => render(() => <Surface />)).toThrow(/error surface/)
  })
})
