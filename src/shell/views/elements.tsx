import type { JSX } from 'solid-js'
import { For, Match, Switch } from 'solid-js'
import { A } from '@solidjs/router'
import { codeDisplay } from '../../domain/fhir/display'
import { record, text } from '../../domain/fhir/json'
import type { Json, Resource } from '../../domain/fhir/types'
import type { TypeDefinition } from '../../domain/conformance/definition'
import { elementAt } from '../../domain/conformance/definition'

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

  return element?.short ?? name
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

  return { type, id, display: text(entry.display) ?? `${type}/${id}` }
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

function countOf(many: number): string {
  return many === 1 ? '1' : String(many)
}

function saidOf(value: Json | undefined): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
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
  return (
    <li class="element">
      <span class="name">{labelOf(props.described, props.path, props.name)}</span>
      <Switch fallback={<span class="value">{saidOf(props.value)}</span>}>
        <Match when={pointingIn(props.value)}>
          {(pointing) => (
            <A class="value" href={`/type/${pointing().type}/${pointing().id}`}>
              {pointing().display}
            </A>
          )}
        </Match>
        <Match when={codedIn(props.value)}>
          {(said) => <span class="value">{said()}</span>}
        </Match>
        <Match when={Array.isArray(props.value)}>
          <details open={itemsOf(props.value).length <= 4}>
            <summary>{countOf(itemsOf(props.value).length)}</summary>
            <ul class="elements">
              <For each={itemsOf(props.value)}>
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
        <Match when={record(props.value)}>
          {(entry) => (
            <details open>
              <summary>{countOf(Object.keys(entry()).length)}</summary>
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
            </details>
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
