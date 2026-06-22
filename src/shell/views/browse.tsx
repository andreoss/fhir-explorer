import type { JSX } from 'solid-js'
import { A, useParams, useSearchParams } from '@solidjs/router'
import { For, Show, createEffect, createMemo, createResource, createSignal } from 'solid-js'
import { readable } from '../../domain/fhir/readable'
import { columnsOf, saidAt, shownOf, truthAt } from '../../domain/fhir/summary'
import { searchParamsOf, supports } from '../../domain/conformance/capability'
import { foremostOf, restOf } from '../../domain/conformance/foremost'
import type { Envelope } from '../../domain/transport/client'
import type { Bundle } from '../../domain/fhir/types'
import { entriesOf, linkOf, totalOf } from '../../domain/transport/paging'
import { gotFrom } from '../asking'
import { Ask } from './ask'
import { Busy, Empty } from '../states'
import { useConnection } from '../server'
import { useTroubles } from '../errors'
import { saidValue } from '../saying'
import { useText } from '../text'
import { useTitle } from '../title'

const SHOWN = 6

type Page = {
  readonly bundle: Bundle
  readonly next?: string
  readonly previous?: string
}

function pageOf(envelope: Envelope<Bundle>): Page {
  const next = linkOf(envelope.resource, 'next')
  const previous = linkOf(envelope.resource, 'previous')

  return {
    bundle: envelope.resource,
    ...(next === undefined ? {} : { next }),
    ...(previous === undefined ? {} : { previous })
  }
}

export function BrowseView(): JSX.Element {
  const params = useParams<{ type: string }>()
  const [query, setQuery] = useSearchParams()
  const connection = useConnection()
  const troubles = useTroubles()
  const text = useText()
  const [follow, setFollow] = createSignal<string | undefined>()

  useTitle(() => params.type)

  createEffect(() => {
    connection.opened(params.type)
  })

  const declared = createMemo(() => {
    const capability = connection.capability()

    return capability === undefined ? [] : searchParamsOf(capability, params.type)
  })

  const searchable = createMemo(() => {
    const capability = connection.capability()

    return capability !== undefined && supports(capability, params.type, 'search-type')
  })

  const foremost = createMemo(() => foremostOf(declared(), SHOWN))
  const rest = createMemo(() => restOf(declared(), SHOWN))

  const asked = createMemo(() =>
    declared().flatMap((declaredParam) => {
      const value = query[declaredParam.name]

      return typeof value === 'string' && value.length > 0
        ? ([[declaredParam.name, value]] as [string, string][])
        : []
    })
  )

  const [page] = createResource(
    () => ({ type: params.type, asked: asked(), at: follow(), client: connection.client() }),
    async (wanted): Promise<Page | undefined> => {
      if (wanted.client === undefined || !searchable()) {
        return undefined
      }

      const answer =
        wanted.at === undefined
          ? await wanted.client.search(wanted.type, wanted.asked)
          : await wanted.client.follow(wanted.at)

      const got = gotFrom(troubles, wanted.type, answer)

      return got === undefined ? undefined : pageOf(got)
    }
  )

  return (
    <section class="page">
      <div class="heading">
        <h1>{params.type}</h1>
        <Busy when={page.loading} />
        <A class="action" href={`/type/${params.type}/new`}>
          {text.say('form.create')}
        </A>
      </div>
      <Show when={declared().length > 0} fallback={<Empty say="search.undeclared" />}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setFollow(undefined)
          }}
        >
          <For each={foremost()}>
            {(declaredParam) => (
              <Ask
                param={declaredParam}
                value={query[declaredParam.name] ?? ''}
                onAsk={(value) => {
                  setFollow(undefined)
                  setQuery({ [declaredParam.name]: value })
                }}
              />
            )}
          </For>
          <button class="primary" type="submit">{text.say('search.run')}</button>
        </form>
        <Show when={rest().length > 0}>
          <details>
            <summary>
              {text.say('search.more')} ({String(rest().length)})
            </summary>
            <div class="fields">
              <For each={rest()}>
                {(declaredParam) => (
                  <Ask
                    param={declaredParam}
                    value={query[declaredParam.name] ?? ''}
                    onAsk={(value) => {
                      setFollow(undefined)
                      setQuery({ [declaredParam.name]: value })
                    }}
                  />
                )}
              </For>
            </div>
          </details>
        </Show>
        <Show when={asked().length > 0}>
          <p class="chips" data-testid="asked">
            <For each={asked()}>
              {([name, value]) => (
                <span class="chip">
                  <span class="mono">
                    {name}={value}
                  </span>
                  <button
                    type="button"
                    aria-label={`${text.say('search.clear')} ${name}`}
                    onClick={() => {
                      setFollow(undefined)
                      setQuery({ [name]: undefined })
                    }}
                  >
                    ✕
                  </button>
                </span>
              )}
            </For>
            <button
              class="small quiet"
              type="button"
              onClick={() => {
                setFollow(undefined)
                setQuery(Object.fromEntries(asked().map(([name]) => [name, undefined])))
              }}
            >
              {text.say('search.clear')}
            </button>
          </p>
        </Show>
      </Show>
      <Show when={page()}>
        {(found) => (
          <>
            <p class="status">
              <span>
                {text.say('search.total')}: {totalOf(found().bundle) ?? entriesOf(found().bundle).length}
              </span>
              <Show when={found().previous}>
                {(at) => (
                  <button
                    type="button"
                    onClick={() => {
                      setFollow(at())
                    }}
                  >
                    {text.say('search.previous')}
                  </button>
                )}
              </Show>
              <Show when={found().next}>
                {(at) => (
                  <button
                    type="button"
                    onClick={() => {
                      setFollow(at())
                    }}
                  >
                    {text.say('search.next')}
                  </button>
                )}
              </Show>
            </p>
            <Show when={entriesOf(found().bundle).length > 0} fallback={<Empty say="search.none" />}>
              <div class="scrolls">
                <table>
                <thead>
                  <tr>
                    <th>{params.type}</th>
                    <For each={columnsOf(entriesOf(found().bundle))}>{(name) => <th>{readable(name)}</th>}</For>
                  </tr>
                </thead>
                <tbody>
                  <For each={entriesOf(found().bundle)}>
                    {(resource) => (
                      <tr>
                        <td>
                          <A href={`/type/${resource.resourceType}/${resource.id ?? ''}`}>{shownOf(resource)}</A>
                        </td>
                        <For each={columnsOf(entriesOf(found().bundle))}>
                          {(name) => <td>{saidValue(text, saidAt(resource, name), truthAt(resource, name))}</td>}
                        </For>
                      </tr>
                    )}
                  </For>
                </tbody>
                </table>
              </div>
            </Show>
          </>
        )}
      </Show>
    </section>
  )
}
