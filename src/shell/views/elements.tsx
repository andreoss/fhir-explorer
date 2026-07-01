import type { JSX } from 'solid-js'
import { For, Match, Switch } from 'solid-js'
import { A } from '@solidjs/router'
import { codeDisplay, quantityDisplay } from '@lib/fhir'
import { readable, shortId } from '@lib/fhir'
import { list, record, scalar, text } from '@lib/fhir'
import type { Json, Resource } from '@lib/fhir'
import type { TypeDefinition } from '@lib/conformance'
import { elementAt } from '@lib/conformance'
import { saidValue } from '../saying'
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

function oneOf(value: Json | undefined): Json | undefined {
  const items = list(value)

  return Array.isArray(value) && items.length === 1 ? items[0] : value
}

const SAID_ABOVE = new Set(['resourceType', 'id', 'meta'])

export function Element(props: {
  readonly name: string
  readonly value: Json | undefined
  readonly path: string
  readonly described: Described
  readonly depth?: number
}): JSX.Element {
  const text = useText()
  const shown = (): Json | undefined => oneOf(props.value)
  const deep = (): number => props.depth ?? 0

  return (
    <li class="element">
      <span class="name" style={{ '--depth': String(deep()) }}>
        {labelOf(props.described, props.path, props.name)}
      </span>
      <Switch fallback={<span class="value">{saidValue(text, scalar(shown()) ?? '', undefined)}</span>}>
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
        <Match when={Array.isArray(shown()) && list(shown()).length > 1}>
          <details open={list(shown()).length <= 4} data-testid="fold">
            <summary>
              {String(list(shown()).length)} {text.say('element.items')}
            </summary>
            <ul class="elements">
              <For each={list(shown())}>
                {(item, index) => (
                  <Element
                    name={`${props.name} ${String(index() + 1)}`}
                    value={item}
                    path={props.path}
                    described={props.described}
                    depth={deep() + 1}
                  />
                )}
              </For>
            </ul>
          </details>
        </Match>
        <Match when={Array.isArray(shown())}>
          <span class="value" />
          <ul class="elements">
            <For each={list(shown())}>
              {(item) => (
                <Element
                  name={props.name}
                  value={item}
                  path={props.path}
                  described={props.described}
                  depth={deep() + 1}
                />
              )}
            </For>
          </ul>
        </Match>
        <Match when={record(shown())}>
          {(entry) => (
            <>
              <span class="value" />
              <ul class="elements">
              <For each={Object.entries(entry())}>
                {([name, value]) => (
                  <Element
                    name={name}
                    value={value}
                    path={`${props.path}.${name}`}
                    described={props.described}
                    depth={deep() + 1}
                  />
                )}
                </For>
              </ul>
            </>
          )}
        </Match>
      </Switch>
    </li>
  )
}

export function Elements(props: { readonly resource: Resource; readonly described: Described }): JSX.Element {
  return (
    <ul class="elements">
      <For each={Object.entries(props.resource).filter(([name]) => !SAID_ABOVE.has(name))}>
        {([name, value]) => (
          <Element name={name} value={value} path={`${props.described.root}.${name}`} described={props.described} />
        )}
      </For>
    </ul>
  )
}
