import type { JSX } from 'solid-js'
import { A, useParams, useSearchParams } from '@solidjs/router'
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { askingFor, questionsFor } from '../../domain/graph/inbound'
import type { Graph, NodeKey } from '../../domain/graph/model'
import { EMPTY, cappedAt, grownFrom, grownTowards, keyOf, neighboursOf, sizeOf } from '../../domain/graph/model'
import { entriesOf } from '../../domain/transport/paging'
import type { Painted, Painter } from '../graph/port'
import { paintWithCytoscape } from '../graph/cytoscape'
import { useConnection } from '../server'
import { useTroubles } from '../errors'
import { useText } from '../text'

const ASKED_AT_ONCE = 3

export function GraphView(props: { readonly painter?: Painter }): JSX.Element {
  const params = useParams<{ type: string; id: string }>()
  const [query, setQuery] = useSearchParams<{ seen?: string; focus?: string }>()
  const connection = useConnection()
  const troubles = useTroubles()
  const text = useText()
  const [graph, setGraph] = createSignal<Graph>(EMPTY)
  const [focus, setFocus] = createSignal<NodeKey>(query.focus ?? keyOf(params.type, params.id))
  const [busy, setBusy] = createSignal(false)

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

    for (const parameter of parameters) {
      const found = await client.search(type, [[parameter, key]])

      if (!found.ok) {
        continue
      }

      for (const resource of entriesOf(found.value.resource)) {
        setGraph((held) => grownTowards(held, key, resource))
      }
    }

    setBusy(false)
  }

  function remember(key: NodeKey): void {
    const seen = (query.seen ?? '').split(',').filter((held) => held.length > 0)

    if (!seen.includes(key)) {
      seen.push(key)
    }

    setQuery({ seen: seen.join(','), focus: key }, { replace: true })
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
      setGraph((held) => grownFrom(held, read.value.resource))
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
          setGraph((held) => grownTowards(held, key, resource))
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

      void (async () => {
        for (const key of opening) {
          await expand(key)
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
        <span class="fact" data-testid="size">
          {sizeOf(graph())}
        </span>
        <Show when={busy()}>
          <span class="fact">{text.say('server.connecting')}</span>
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
      <div class="graph" data-testid="surface" ref={setSurface} />
      <Show when={asking().length > ASKED_AT_ONCE}>
        <details class="asking">
          <summary>{text.say('graph.inbound')}</summary>
          <ul class="types">
            <For each={asking()}>
              {(entry) => (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      void askAbout(entry.type, focus())
                    }}
                  >
                    {entry.type}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </details>
      </Show>
      <Show when={sizeOf(graph()) > 0} fallback={<p>{text.say('graph.empty')}</p>}>
        <ul class="pointing">
          <For each={neighboursOf(graph(), focus())}>
            {(node) => (
              <li>
                <button
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
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
