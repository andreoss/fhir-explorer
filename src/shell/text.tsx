import type { JSX } from 'solid-js'
import { createContext, createMemo, createSignal, useContext } from 'solid-js'
import type { Catalogue, TextKey } from '../i18n'
import { catalogueFor } from '../i18n'

export type Text = {
  say: (key: TextKey) => string
  language: () => string
  direction: () => 'ltr' | 'rtl'
  choose: (language: string) => void
}

const LANGUAGE = 'fhir-explorer.language'

const TextContext = createContext<Text>()

export function TextProvider(props: { readonly language?: string; readonly children: JSX.Element }): JSX.Element {
  const kept = ((): string | undefined => {
    try {
      return globalThis.localStorage.getItem(LANGUAGE) ?? undefined
    } catch {
      return undefined
    }
  })()
  const [language, setLanguage] = createSignal(props.language ?? kept ?? 'en')
  const catalogue = createMemo<Catalogue>(() => catalogueFor(language()))

  const text: Text = {
    say: (key) => catalogue()[key],
    language,
    direction: () => catalogue().direction,
    choose: (wanted) => {
      setLanguage(wanted)

      try {
        globalThis.localStorage.setItem(LANGUAGE, wanted)
      } catch {
        /* a reader who allows no storage keeps their choice for this session */
      }
    }
  }

  return <TextContext.Provider value={text}>{props.children}</TextContext.Provider>
}

export function useText(): Text {
  const text = useContext(TextContext)

  if (text === undefined) {
    throw new Error('no catalogue is in scope')
  }

  return text
}
