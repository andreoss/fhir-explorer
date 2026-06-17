import type { JSX } from 'solid-js'
import type { SearchParam } from '../../domain/conformance/capability'

export function Ask(props: {
  readonly param: SearchParam
  readonly value: string | readonly string[] | undefined
  readonly onAsk: (value: string | undefined) => void
}): JSX.Element {
  const said = (): string => {
    const held = props.value

    return Array.isArray(held) ? held.join(',') : (held as string | undefined) ?? ''
  }

  return (
    <label class="field">
      <span class="field-head">
        <span class="field-name">{props.param.name}</span>
        <span class="kind">{props.param.type}</span>
      </span>
      <input
        aria-label={props.param.name}
        value={said()}
        onChange={(event) => {
          props.onAsk(event.currentTarget.value || undefined)
        }}
      />
    </label>
  )
}
