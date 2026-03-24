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

describe('choosing a language', () => {
  it('says the same thing in the language that was chosen', async () => {
    function Chooser() {
      const text = useText()

      return (
        <div>
          <button onClick={() => { text.choose('ru') }}>choose</button>
          <p>{text.say('nav.types')}</p>
          <span data-testid="dir">{text.direction()}</span>
        </div>
      )
    }

    const screen = render(() => (
      <TextProvider>
        <Chooser />
      </TextProvider>
    ))

    expect(screen.getByText('Types')).toBeInTheDocument()

    screen.getByText('choose').click()

    expect(await screen.findByText('Типы')).toBeInTheDocument()
    expect(screen.getByTestId('dir').textContent).toBe('ltr')
  })

  it('lays a page out the way the catalogue reads', () => {
    function Framed() {
      const text = useText()

      return <main dir={text.direction()}>{text.say('nav.types')}</main>
    }

    const screen = render(() => (
      <TextProvider language="en">
        <Framed />
      </TextProvider>
    ))

    expect(screen.getByRole('main').getAttribute('dir')).toBe('ltr')
  })
})
