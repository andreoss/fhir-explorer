import type { JSX } from 'solid-js'
import { createContext, createSignal, useContext } from 'solid-js'

export type Trouble = {
  readonly at: string
  readonly message: string
  readonly id: number
}

export type Troubles = {
  all: () => readonly Trouble[]
  report: (at: string, message: string) => void
  dismiss: (id: number) => void
  clear: () => void
}

const TroubleContext = createContext<Troubles>()

export function TroubleProvider(props: { readonly children: JSX.Element }): JSX.Element {
  const [all, setAll] = createSignal<readonly Trouble[]>([])
  let next = 0

  const troubles: Troubles = {
    all,
    report: (at, message) => {
      next += 1
      setAll((kept) => [{ at, message, id: next }, ...kept].slice(0, 20))
    },
    dismiss: (id) => {
      setAll((kept) => kept.filter((trouble) => trouble.id !== id))
    },
    clear: () => {
      setAll([])
    }
  }

  return <TroubleContext.Provider value={troubles}>{props.children}</TroubleContext.Provider>
}

export function useTroubles(): Troubles {
  const troubles = useContext(TroubleContext)

  if (troubles === undefined) {
    throw new Error('no error surface is in scope')
  }

  return troubles
}
