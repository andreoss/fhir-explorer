import { render, waitFor } from '@solidjs/testing-library'
import { For } from 'solid-js'
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

describe('what the interface says back', () => {
  function Actor() {
    const troubles = useTroubles()

    return (
      <div>
        <button onClick={() => { troubles.announce('Saved') }}>announce</button>
        <button onClick={() => { troubles.report('the server', 'it refused') }}>report</button>
        <button onClick={() => { troubles.resolve('the server') }}>resolve</button>
        <ul>
          <For each={troubles.said()}>{(one) => <li>{one.message}</li>}</For>
        </ul>
        <ul>
          <For each={troubles.all()}>{(one) => <li>{one.message}</li>}</For>
        </ul>
      </div>
    )
  }

  function mount() {
    return render(() => (
      <TroubleProvider>
        <Actor />
      </TroubleProvider>
    ))
  }

  it('says what just happened', async () => {
    const screen = mount()

    screen.getByText('announce').click()

    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('takes back what failed once the same thing works', async () => {
    const screen = mount()

    screen.getByText('report').click()
    await screen.findByText('it refused')

    screen.getByText('resolve').click()

    await waitFor(() => {
      expect(screen.queryByText('it refused')).not.toBeInTheDocument()
    })
  })

  it('keeps the newest trouble first', async () => {
    const screen = mount()

    screen.getByText('report').click()
    screen.getByText('report').click()

    await waitFor(() => {
      expect(screen.getAllByText('it refused')).toHaveLength(2)
    })
  })
})
