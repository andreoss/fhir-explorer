import type { JSX } from 'solid-js'
import { For, Match, Switch } from 'solid-js'
import { A } from '@solidjs/router'
import { codeDisplay, quantityDisplay } from '../../domain/fhir/display'
import { readable, shortId } from '../../domain/fhir/readable'
import { record, text } from '../../domain/fhir/json'
import type { Json, Resource } from '../../domain/fhir/types'
import type { TypeDefinition } from '../../domain/conformance/definition'
import { elementAt } from '../../domain/conformance/definition'
import { saidTruth } from '../saying'
import { useText } from '../text'

export type Described = {
  readonly definition: TypeDefinition | undefined
  readonly root: string
}

type Pointing = {
  readonly type: string
  readonly id: string
  readonly display: string
}

function labelOf(described: Described, path: string, name: string): string {
  const element = described.definition === undefined ? undefined : elementAt(described.definition, path)

  return element?.short ?? readable(name)
}

function pointingIn(value: Json | undefined): Pointing | undefined {
  const entry = record(value)
  const reference = text(entry?.reference)

  if (entry === undefined || reference === undefined || reference.startsWith('#')) {
    return undefined
  }

  const parts = reference.split('/')
  const id = parts.pop() ?? ''
  const type = text(entry.type) ?? parts.pop() ?? ''

  if (type.length === 0 || id.length === 0) {
    return undefined
  }

  return { type, id, display: text(entry.display) ?? shortId(`${type}/${id}`) }
}

function measuredIn(value: Json | undefined): string | undefined {
  return quantityDisplay(value)
}

function codedIn(value: Json | undefined): string | undefined {
  const entry = record(value)

  if (entry === undefined || (entry.coding === undefined && entry.code === undefined)) {
    return undefined
  }

  return codeDisplay(value)
}

function itemsOf(value: Json | undefined): readonly Json[] {
  return Array.isArray(value) ? (value as readonly Json[]) : []
}

function oneOf(value: Json | undefined): Json | undefined {
  const items = itemsOf(value)

  return Array.isArray(value) && items.length === 1 ? items[0] : value
}

function saidOf(value: Json | undefined): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return ''
}

export function Element(props: {
  readonly name: string
  readonly value: Json | undefined
  readonly path: string
  readonly described: Described
}): JSX.Element {
  const text = useText()
  const shown = (): Json | undefined => oneOf(props.value)

  return (
    <li class="element">
      <span class="name">{labelOf(props.described, props.path, props.name)}</span>
      <Switch fallback={<span class="value">{saidTruth(text, saidOf(shown()), undefined)}</span>}>
        <Match when={typeof shown() === 'boolean'}>
          <span class="value">{text.say(shown() === true ? 'value.yes' : 'value.no')}</span>
        </Match>
        <Match when={pointingIn(shown())}>
          {(pointing) => (
            <A class="value" href={`/type/${pointing().type}/${pointing().id}`}>
              {pointing().display}
            </A>
          )}
        </Match>
        <Match when={measuredIn(shown())}>
          {(said) => <span class="value">{said()}</span>}
        </Match>
        <Match when={codedIn(shown())}>
          {(said) => <span class="value">{said()}</span>}
        </Match>
        <Match when={Array.isArray(shown()) && itemsOf(shown()).length > 1}>
          <details open={itemsOf(shown()).length <= 4} data-testid="fold">
            <summary>
              {String(itemsOf(shown()).length)} {text.say('element.items')}
            </summary>
            <ul class="elements">
              <For each={itemsOf(shown())}>
                {(item, index) => (
                  <Element
                    name={`${props.name} ${String(index() + 1)}`}
                    value={item}
                    path={props.path}
                    described={props.described}
                  />
                )}
              </For>
            </ul>
          </details>
        </Match>
        <Match when={Array.isArray(shown())}>
          <ul class="elements">
            <For each={itemsOf(shown())}>
              {(item) => (
                <Element name={props.name} value={item} path={props.path} described={props.described} />
              )}
            </For>
          </ul>
        </Match>
        <Match when={record(shown())}>
          {(entry) => (
            <ul class="elements">
              <For each={Object.entries(entry())}>
                {([name, value]) => (
                  <Element
                    name={name}
                    value={value}
                    path={`${props.path}.${name}`}
                    described={props.described}
                  />
                )}
              </For>
            </ul>
          )}
        </Match>
      </Switch>
    </li>
  )
}

export function Elements(props: { readonly resource: Resource; readonly described: Described }): JSX.Element {
  return (
    <ul class="elements">
      <For each={Object.entries(props.resource).filter(([name]) => name !== 'resourceType')}>
        {([name, value]) => (
          <Element name={name} value={value} path={`${props.described.root}.${name}`} described={props.described} />
        )}
      </For>
    </ul>
  )
}
