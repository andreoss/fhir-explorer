import type { JSX } from 'solid-js'
import { A, useParams, useSearchParams } from '@solidjs/router'
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import { displayOf } from '../../domain/fhir/display'
import type { Resource } from '../../domain/fhir/types'
import { askingFor, questionsFor } from '../../domain/graph/inbound'
import type { Graph, NodeKey } from '../../domain/graph/model'
import {
  EMPTY,
  cappedAt,
  grownFrom,
  grownTowards,
  keyOf,
  neighboursOf,
  pathBetween,
  sizeOf,
  withoutNode
} from '../../domain/graph/model'
import { entriesOf } from '../../domain/transport/paging'
import type { Painted, Painter } from '../graph/port'
import { paintWithCytoscape } from '../graph/cytoscape'
import { Empty } from '../states'
import { useConnection } from '../server'
import { useTroubles } from '../errors'
import { useText } from '../text'
import { useTitle } from '../title'

const ASKED_AT_ONCE = 3
const SHOWN_IN_PLACE = 6

function saidOf(resource: Resource): readonly (readonly [string, string])[] {
  return Object.entries(resource)
    .filter(([name]) => name !== 'resourceType' && name !== 'id' && name !== 'meta')
    .flatMap(([name, value]) =>
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? ([[name, String(value)]] as const)
        : []
    )
    .slice(0, SHOWN_IN_PLACE)
}

export function GraphView(props: { readonly painter?: Painter }): JSX.Element {
  const params = useParams<{ type: string; id: string }>()
  const [query, setQuery] = useSearchParams<{ seen?: string; focus?: string; asked?: string }>()
  const connection = useConnection()
  const troubles = useTroubles()
  const text = useText()
  const [graph, setGraph] = createSignal<Graph>(EMPTY)
  const [focus, setFocus] = createSignal<NodeKey>(query.focus ?? keyOf(params.type, params.id))
  const [busy, setBusy] = createSignal(false)
  const [ways, setWays] = createSignal('')

  useTitle(() => `${text.say('graph.title')}: ${focus()}`)
  const [answered, setAnswered] = createStore<Record<string, number>>({})
  const [held, setHeld] = createStore<Record<string, Resource>>({})

  const [surface, setSurface] = createSignal<HTMLDivElement | undefined>()
  let painted: Painted | undefined

  const asking = createMemo(() => {
    const capability = connection.capability()

    return capability === undefined ? [] : askingFor(capability)
  })

  async function askAbout(type: string, key: NodeKey): Promise<void> {
    const client = connection.client()
    const parameters = asking().find((entry) => entry.type === type)?.parameters ?? []

    if (client === undefined) {
      return
    }

    setBusy(true)
    remembered(type, key)

    let many = 0

    for (const parameter of parameters) {
      const found = await client.search(type, [[parameter, key]])

      if (!found.ok) {
        continue
      }

      for (const resource of entriesOf(found.value.resource)) {
        many += 1
        setHeld(`${resource.resourceType}/${resource.id ?? ''}`, resource)
        setGraph((kept) => grownTowards(kept, key, resource))
      }
    }

    setAnswered(type, many)
    setBusy(false)
  }

  function listed(held: string | undefined): string[] {
    return (held ?? '').split(',').filter((entry) => entry.length > 0)
  }

  function remember(key: NodeKey): void {
    const seen = listed(query.seen)

    if (!seen.includes(key)) {
      seen.push(key)
    }

    setQuery({ seen: seen.join(','), focus: key }, { replace: true })
  }

  function remembered(type: string, key: NodeKey): void {
    const asked = listed(query.asked)
    const one = `${key}|${type}`

    if (!asked.includes(one)) {
      asked.push(one)
    }

    setQuery({ asked: asked.join(',') }, { replace: true })
  }

  async function expand(key: NodeKey): Promise<void> {
    const client = connection.client()
    const capability = connection.capability()
    const [type, id] = key.split('/')

    if (client === undefined || type === undefined || id === undefined) {
      return
    }

    setBusy(true)
    remember(key)

    const read = await client.read(type, id)

    if (read.ok) {
      setHeld(key, read.value.resource)
      setGraph((kept) => grownFrom(kept, read.value.resource))
    } else {
      troubles.report(key, read.error.message)
    }

    const questions = capability === undefined ? [] : questionsFor(capability, key)

    if (questions.length <= ASKED_AT_ONCE) {
      for (const question of questions) {
        const found = await client.search(question.type, [[question.parameter, key]])

        if (!found.ok) {
          continue
        }

        for (const resource of entriesOf(found.value.resource)) {
          setGraph((kept) => grownTowards(kept, key, resource))
        }
      }
    }

    setBusy(false)
  }

  onMount(() => {
    const element = surface()

    if (element !== undefined) {
      painted = (props.painter ?? paintWithCytoscape)(element)
      painted.onChoose((key) => {
        setFocus(key)
        void expand(key)
      })
    }
  })

  onCleanup(() => {
    painted?.destroy()
  })

  createEffect(() => {
    painted?.show(graph(), focus())
  })

  createEffect(() => {
    if (connection.client() !== undefined && connection.capability() !== undefined && sizeOf(graph()) === 0) {
      const seen = (query.seen ?? '').split(',').filter((key) => key.length > 0)
      const opening = seen.length > 0 ? seen : [keyOf(params.type, params.id)]

      const asked = listed(query.asked)

      void (async () => {
        for (const key of opening) {
          await expand(key)
        }

        for (const one of asked) {
          const [key, type] = one.split('|')

          if (key !== undefined && type !== undefined) {
            await askAbout(type, key)
          }
        }

        setFocus(query.focus ?? opening[0] ?? keyOf(params.type, params.id))
      })()
    }
  })

  return (
    <section class="page">
      <h1>{text.say('graph.title')}</h1>
      <p class="status">
        <span data-testid="focus">{focus()}</span>
        <span class="fact">
          {text.say('graph.nodes')}: <span data-testid="size">{sizeOf(graph())}</span>
        </span>
        <Show when={busy()}>
          <span class="busy" role="status" data-testid="busy">
            {text.say('state.busy')}
          </span>
        </Show>
        <Show when={cappedAt(graph())}>
          <span class="fact" data-testid="capped">
            {text.say('graph.capped')}
          </span>
        </Show>
        <A href={`/type/${focus().split('/')[0] ?? ''}/${focus().split('/')[1] ?? ''}`}>
          {text.say('resource.rendered')}
        </A>
      </p>
      <p class="legend">
        <span>
          <i class="dot focus" /> {text.say('graph.focus')}
        </span>
        <span>
          <i class="dot read" /> {text.say('graph.read')}
        </span>
        <span>
          <i class="dot unread" /> {text.say('graph.unread')}
        </span>
        <button class="small" type="button" onClick={() => painted?.fit()}>
          {text.say('graph.fit')}
        </button>
        <button class="small" type="button" onClick={() => painted?.zoom(1.3)}>
          {text.say('graph.closer')}
        </button>
        <button class="small" type="button" onClick={() => painted?.zoom(1 / 1.3)}>
          {text.say('graph.further')}
        </button>
        <button
          class="small"
          type="button"
          onClick={() => {
            setGraph(EMPTY)
            setQuery({ seen: undefined, asked: undefined, focus: undefined }, { replace: true })
            setFocus(keyOf(params.type, params.id))
          }}
        >
          {text.say('graph.again')}
        </button>
      </p>
      <p class="note">{text.say('graph.how')}</p>
      <div class="graph" data-testid="surface" ref={setSurface} />
      <Show when={held[focus()]}>
        {(resource) => (
          <div class="card" data-testid="inspected">
            <h2>{displayOf(resource())}</h2>
            <p class="status">
              <span class="mono">{focus()}</span>
              <A href={`/type/${resource().resourceType}/${resource().id ?? ''}`}>
                {text.say('resource.rendered')}
              </A>
            </p>
            <ul class="elements">
              <For each={saidOf(resource())}>
                {([name, value]) => (
                  <li class="element">
                    <span class="name">{name}</span>
                    <span class="value">{value}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </Show>
      <Show when={asking().length > ASKED_AT_ONCE}>
        <details class="asking">
          <summary>{text.say('graph.inbound')}</summary>
          <input
            aria-label={text.say('graph.ways')}
            placeholder={text.say('graph.ways')}
            value={ways()}
            onInput={(event) => {
              setWays(event.currentTarget.value)
            }}
          />
          <ul class="types">
            <For each={asking().filter((entry) => entry.type.toLowerCase().includes(ways().toLowerCase()))}>
              {(entry) => (
                <li>
                  <button
                    class="small"
                    type="button"
                    onClick={() => {
                      void askAbout(entry.type, focus())
                    }}
                  >
                    {entry.type}
                  </button>
                  <Show when={answered[entry.type] !== undefined}>
                    <span class="quiet">
                      {answered[entry.type] === 0
                        ? text.say('graph.silent')
                        : `${String(answered[entry.type])} ${text.say('graph.answered')}`}
                    </span>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </details>
      </Show>
      <Show when={sizeOf(graph()) > 0} fallback={<Empty say="graph.empty" />}>
        <ul class="pointing">
          <For each={neighboursOf(graph(), focus())}>
            {(node) => (
              <li>
                <button
                  class="small"
                  type="button"
                  onClick={() => {
                    setFocus(node.key)
                    void expand(node.key)
                  }}
                >
                  {text.say('graph.expand')}
                </button>
                <span>
                  {node.type}: {node.display}
                </span>
                <Show when={pathBetween(graph(), focus(), node.key)}>
                  {(path) => <span class="quiet mono">{path()}</span>}
                </Show>
                <button
                  class="small quiet"
                  type="button"
                  aria-label={`${text.say('graph.drop')} ${node.key}`}
                  onClick={() => {
                    setGraph((kept) => withoutNode(kept, node.key))
                  }}
                >
                  {text.say('graph.drop')}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
