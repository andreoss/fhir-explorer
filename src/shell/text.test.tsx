import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { TextProvider, useText } from './text'

function Said() {
  const text = useText()

  return (
    <p>
      {text.say('nav.types')} {text.direction()} {text.language()}
    </p>
  )
}

describe('catalogue', () => {
  it('says what the catalogue says', () => {
    const screen = render(() => (
      <TextProvider>
        <Said />
      </TextProvider>
    ))

    expect(screen.getByText(/Types ltr en/)).toBeInTheDocument()
  })

  it('falls back to what it has when asked for a language it does not carry', () => {
    const screen = render(() => (
      <TextProvider language="xx">
        <Said />
      </TextProvider>
    ))

    expect(screen.getByText(/Types/)).toBeInTheDocument()
  })

  it('refuses to be used without a catalogue in scope', () => {
    expect(() => render(() => <Said />)).toThrow(/catalogue/)
  })
})
