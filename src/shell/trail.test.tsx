import { HashRouter, Route } from '@solidjs/router'
import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { TextProvider } from './text'
import { Trail, stepsOf } from './trail'

const say = (key: keyof typeof en): string => en[key]

describe('the trail', () => {
  it('starts at the server, wherever a reader is', () => {
    expect(stepsOf('/', say)[0]).toEqual({ said: 'Server', at: '/' })
    expect(stepsOf('/types', say)[0]).toEqual({ said: 'Server', at: '/' })
  })

  it('says the type a reader is looking at', () => {
    expect(stepsOf('/type/Patient', say).map((step) => step.said)).toEqual(['Server', 'Types', 'Patient'])
  })

  it('says the resource, and does not link the place a reader already is', () => {
    const steps = stepsOf('/type/Patient/p1', say)

    expect(steps.map((step) => step.said)).toEqual(['Server', 'Types', 'Patient', 'p1'])
    expect(steps.at(-1)?.at).toBe('/type/Patient/p1')
  })

  it('says which of a resource a reader is looking at', () => {
    expect(stepsOf('/type/Patient/p1/history', say).at(-1)).toEqual({ said: 'History' })
    expect(stepsOf('/type/Patient/p1/version/2', say).at(-1)).toEqual({ said: 'History' })
    expect(stepsOf('/type/Patient/p1/edit', say).at(-1)).toEqual({ said: 'Edit' })
    expect(stepsOf('/type/Patient/new', say).at(-1)).toEqual({ said: 'Create' })
  })

  it('says a graph is a graph of a resource', () => {
    expect(stepsOf('/graph/Patient/p1', say).map((step) => step.said)).toEqual([
      'Server',
      'Types',
      'Patient',
      'p1',
      'Graph'
    ])
  })

  it('says nothing of an address it does not know', () => {
    expect(stepsOf('/nowhere', say)).toHaveLength(1)
    expect(stepsOf('/graph/Patient', say)).toHaveLength(1)
  })

  it('shows itself as a trail a reader can walk back', () => {
    globalThis.location.hash = '#/type/Patient/p1'

    const screen = render(() => (
      <TextProvider>
        <HashRouter>
          <Route path="*" component={Trail} />
        </HashRouter>
      </TextProvider>
    ))

    expect(screen.getByRole('navigation', { name: 'You are here' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Types' }).getAttribute('href')).toBe('#/types')
  })
})

describe('a trail with nothing to add', () => {
  it('says nothing at the place a reader starts', () => {
    globalThis.location.hash = '#/'

    const screen = render(() => (
      <TextProvider>
        <HashRouter>
          <Route path="*" component={Trail} />
        </HashRouter>
      </TextProvider>
    ))

    expect(screen.queryByRole('navigation', { name: 'You are here' })).not.toBeInTheDocument()
  })
})
