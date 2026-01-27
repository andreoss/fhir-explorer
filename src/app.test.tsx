import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { App } from './app'

describe('app', () => {
  it('renders a main region', () => {
    const screen = render(() => <App />)

    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
