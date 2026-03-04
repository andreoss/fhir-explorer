import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'
import { record, text } from '../../domain/fhir/json'
import type { Json, Resource } from '../../domain/fhir/types'
import type { TypeDefinition } from '../../domain/conformance/definition'
import { elementAt } from '../../domain/conformance/definition'

function said(value: Json | undefined): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return ''
}

function itemsOf(value: Json | undefined): readonly Json[] {
  return Array.isArray(value) ? (value as readonly Json[]) : []
}

export type Described = {
  readonly definition: TypeDefinition | undefined
  readonly root: string
}

function labelOf(described: Described, path: string, name: string): string {
  const element = described.definition === undefined ? undefined : elementAt(described.definition, path)

  return element?.short ?? name
}

function referenceIn(value: Json | undefined): { readonly type: string; readonly id: string } | undefined {
  const entry = record(value)
  const reference = text(entry?.reference)

  if (reference === undefined || reference.startsWith('#')) {
    return undefined
  }

  const parts = reference.split('/')
  const id = parts.pop() ?? ''
  const type = text(entry?.type) ?? parts.pop() ?? ''

  return type.length > 0 && id.length > 0 ? { type, id } : undefined
}

export function Element(props: {
  readonly name: string
  readonly value: Json | undefined
  readonly path: string
  readonly described: Described
}): JSX.Element {
  const pointing = (): { readonly type: string; readonly id: string } | undefined => referenceIn(props.value)

  return (
    <li class="element">
      <span class="name">{labelOf(props.described, props.path, props.name)}</span>
      <Show
        when={pointing()}
        fallback={
          <Show
            when={record(props.value) ?? (Array.isArray(props.value) ? props.value : undefined)}
            fallback={<span class="value">{said(props.value)}</span>}
          >
            <Show
              when={Array.isArray(props.value)}
              fallback={
                <ul class="elements">
                  <For each={Object.entries(record(props.value) ?? {})}>
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
              }
            >
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
            </Show>
          </Show>
        }
      >
        {(found) => (
          <A class="value" href={`/type/${found().type}/${found().id}`}>
            {text(record(props.value)?.display) ?? `${found().type}/${found().id}`}
          </A>
        )}
      </Show>
    </li>
  )
}

export function Elements(props: { readonly resource: Resource; readonly described: Described }): JSX.Element {
  return (
    <ul class="elements">
      <For each={Object.entries(props.resource).filter(([name]) => name !== 'resourceType')}>
        {([name, value]) => (
          <Element
            name={name}
            value={value}
            path={`${props.described.root}.${name}`}
            described={props.described}
          />
        )}
      </For>
    </ul>
  )
}
