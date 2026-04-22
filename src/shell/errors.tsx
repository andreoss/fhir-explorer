import type { JSX } from 'solid-js'
import { createContext, createSignal, useContext } from 'solid-js'

export type Trouble = {
  readonly at: string
  readonly message: string
  readonly id: number
}

export type Said = {
  readonly message: string
  readonly id: number
}

export type Troubles = {
  all: () => readonly Trouble[]
  said: () => readonly Said[]
  report: (at: string, message: string) => void
  resolve: (at: string) => void
  announce: (message: string) => void
  dismiss: (id: number) => void
  clear: () => void
}

const TroubleContext = createContext<Troubles>()

export function TroubleProvider(props: { readonly children: JSX.Element }): JSX.Element {
  const [all, setAll] = createSignal<readonly Trouble[]>([])
  const [said, setSaid] = createSignal<readonly Said[]>([])
  let next = 0

  const troubles: Troubles = {
    all,
    said,

    report: (at, message) => {
      next += 1
      setAll((kept) => [{ at, message, id: next }, ...kept].slice(0, 20))
    },

    resolve: (at) => {
      setAll((kept) => kept.filter((trouble) => trouble.at !== at))
    },

    announce: (message) => {
      next += 1

      const id = next

      setSaid((kept) => [{ message, id }, ...kept].slice(0, 3))
      setTimeout(() => {
        setSaid((kept) => kept.filter((one) => one.id !== id))
      }, 4000)
    },
    dismiss: (id) => {
      setAll((kept) => kept.filter((trouble) => trouble.id !== id))
    },
    clear: () => {
      setAll([])
      setSaid([])
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
