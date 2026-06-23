import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { Field } from '../../domain/form'
import { list, scalar } from '../../domain/fhir'
import type { Json } from '../../domain/fhir'
import { useText } from '../text'

export type Steps = readonly (string | number)[]

export type Editing = {
  readonly at: (steps: Steps) => Json | undefined
  readonly change: (steps: Steps, value: Json | undefined) => void
  readonly said: (path: string) => string | undefined
}

function saidOf(value: Json | undefined): string {
  const said = scalar(value)

  if (said !== undefined) {
    return said
  }

  return value === undefined || value === null ? '' : JSON.stringify(value)
}

function emptyFor(field: Field): Json {
  return field.kind === 'nested' ? {} : ''
}

function typed(field: Field, written: string): Json | undefined {
  if (written.length === 0) {
    return undefined
  }

  if (field.kind === 'number') {
    return Number(written)
  }

  if (field.kind === 'json') {
    try {
      return JSON.parse(written) as Json
    } catch {
      return written
    }
  }

  return written
}

function One(props: { readonly field: Field; readonly steps: Steps; readonly editing: Editing }): JSX.Element {
  const text = useText()
  const name = (): string => {
    const at = [...props.steps].reverse().find((step) => typeof step === 'number')

    return at === undefined ? props.field.label : `${props.field.label} ${String(at + 1)}`
  }

  return (
    <Show
      when={props.field.kind === 'nested'}
      fallback={
        <Show
          when={props.field.kind === 'flag'}
          fallback={
            <input
              aria-label={name()}
              value={saidOf(props.editing.at(props.steps))}
              onInput={(event) => {
                props.editing.change(props.steps, typed(props.field, event.currentTarget.value))
              }}
            />
          }
        >
          <input
            aria-label={name()}
            type="checkbox"
            checked={props.editing.at(props.steps) === true}
            onChange={(event) => {
              props.editing.change(props.steps, event.currentTarget.checked)
            }}
          />
        </Show>
      }
    >
      <ul class="elements">
        <For each={props.field.children}>
          {(child) => (
            <FieldView field={child} steps={[...props.steps, child.name]} editing={props.editing} />
          )}
        </For>
      </ul>
      <Show when={props.field.children.length === 0}>
        <span class="quiet">{text.say('resource.empty')}</span>
      </Show>
    </Show>
  )
}

export function FieldView(props: {
  readonly field: Field
  readonly steps: Steps
  readonly editing: Editing
}): JSX.Element {
  const text = useText()

  return (
    <li class="element">
      <span class="name">
        {props.field.label}
        <Show when={props.field.required}>
          <span class="quiet"> {text.say('form.required')}</span>
        </Show>
      </span>
      <Show
        when={props.field.repeats}
        fallback={<One field={props.field} steps={props.steps} editing={props.editing} />}
      >
        <div class="repeats">
          <For each={list(props.editing.at(props.steps))}>
            {(_item, index) => (
              <div class="repeat">
                <One field={props.field} steps={[...props.steps, index()]} editing={props.editing} />
                <button
                  class="small quiet"
                  type="button"
                  onClick={() => {
                    const held = [...list(props.editing.at(props.steps))]

                    held.splice(index(), 1)
                    props.editing.change(props.steps, held)
                  }}
                >
                  {text.say('form.remove')}
                </button>
              </div>
            )}
          </For>
          <button
            class="small"
            type="button"
            onClick={() => {
              props.editing.change(props.steps, [
                ...list(props.editing.at(props.steps)),
                emptyFor(props.field)
              ])
            }}
          >
            {text.say('form.add')} {props.field.label}
          </button>
        </div>
      </Show>
      <Show when={props.editing.said(props.field.path)}>
        {(said) => <span class="trouble">{said()}</span>}
      </Show>
    </li>
  )
}
