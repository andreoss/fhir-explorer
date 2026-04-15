import type { JSX } from 'solid-js'
import { A, useLocation } from '@solidjs/router'
import { For, Show } from 'solid-js'
import { useText } from './text'

export type Step = {
  readonly said: string
  readonly at?: string
}

export function stepsOf(path: string, say: (key: 'nav.server' | 'nav.types' | 'nav.graph' | 'resource.history' | 'resource.edit' | 'form.create') => string): readonly Step[] {
  const parts = path.split('/').filter((part) => part.length > 0)
  const steps: Step[] = [{ said: say('nav.server'), at: '/' }]

  if (parts[0] === 'types') {
    steps.push({ said: say('nav.types') })

    return steps
  }

  if (parts[0] === 'type' && parts[1] !== undefined) {
    steps.push({ said: say('nav.types'), at: '/types' })
    steps.push({ said: parts[1], at: `/type/${parts[1]}` })

    if (parts[2] === 'new') {
      steps.push({ said: say('form.create') })

      return steps
    }

    if (parts[2] !== undefined) {
      steps.push({ said: parts[2], at: `/type/${parts[1]}/${parts[2]}` })
    }

    if (parts[3] === 'history' || parts[3] === 'version') {
      steps.push({ said: say('resource.history') })
    }

    if (parts[3] === 'edit') {
      steps.push({ said: say('resource.edit') })
    }

    return steps
  }

  if (parts[0] === 'graph' && parts[1] !== undefined && parts[2] !== undefined) {
    steps.push({ said: say('nav.types'), at: '/types' })
    steps.push({ said: parts[1], at: `/type/${parts[1]}` })
    steps.push({ said: parts[2], at: `/type/${parts[1]}/${parts[2]}` })
    steps.push({ said: say('nav.graph') })

    return steps
  }

  return steps
}

export function Trail(): JSX.Element {
  const location = useLocation()
  const text = useText()

  const steps = (): readonly Step[] => stepsOf(location.pathname, text.say)

  return (
    <Show when={steps().length > 1}>
      <nav class="trail" aria-label={text.say('trail.here')}>
        <For each={steps()}>
          {(step, at) => (
            <>
              <Show when={at() > 0}>
                <span aria-hidden="true">›</span>
              </Show>
              <Show when={step.at} fallback={<span aria-current="page">{step.said}</span>}>
                {(where) => <A href={where()}>{step.said}</A>}
              </Show>
            </>
          )}
        </For>
      </nav>
    </Show>
  )
}
