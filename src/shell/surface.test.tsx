import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { TroubleProvider, useTroubles } from './errors'
import { Surface } from './surface'
import { TextProvider } from './text'

function Raiser(props: { readonly message: string }) {
  const troubles = useTroubles()

  return (
    <button
      onClick={() => {
        troubles.report('the server', props.message)
      }}
    >
      raise
    </button>
  )
}

function mount(message = 'it refused') {
  return render(() => (
    <TextProvider>
      <TroubleProvider>
        <Raiser message={message} />
        <Surface />
      </TroubleProvider>
    </TextProvider>
  ))
}

describe('the error surface', () => {
  it('shows nothing while nothing has gone wrong', () => {
    const screen = mount()

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('shows what failed and against what', async () => {
    const screen = mount()

    screen.getByText('raise').click()

    expect(await screen.findByText('it refused')).toBeInTheDocument()
    expect(screen.getByText('the server')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'What went wrong' })).toBeInTheDocument()
  })

  it('lets a reader put away what it has read', async () => {
    const screen = mount()

    screen.getByText('raise').click()
    await screen.findByText('it refused')
    screen.getByText('Dismiss').click()

    expect(screen.queryByText('it refused')).not.toBeInTheDocument()
  })
})
