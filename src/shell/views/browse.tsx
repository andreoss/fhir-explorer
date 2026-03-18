import type { JSX } from 'solid-js'
import { A, useParams, useSearchParams } from '@solidjs/router'
import { For, Show, createMemo, createResource, createSignal } from 'solid-js'
import { displayOf } from '../../domain/fhir/display'
import { searchParamsOf, supports } from '../../domain/conformance/capability'
import type { Envelope } from '../../domain/transport/client'
import type { Bundle } from '../../domain/fhir/types'
import { entriesOf, linkOf, totalOf } from '../../domain/transport/paging'
import { useConnection } from '../server'
import { useTroubles } from '../errors'
import { useText } from '../text'

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

  const declared = createMemo(() => {
    const capability = connection.capability()

    return capability === undefined ? [] : searchParamsOf(capability, params.type)
  })

  const searchable = createMemo(() => {
    const capability = connection.capability()

    return capability !== undefined && supports(capability, params.type, 'search-type')
  })

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

      if (!answer.ok) {
        troubles.report(wanted.type, answer.error.message)
        return undefined
      }

      return pageOf(answer.value)
    }
  )

  return (
    <section class="page">
      <h1>{params.type}</h1>
      <p class="status">
        <A href={`/type/${params.type}/new`}>{text.say('form.create')}</A>
      </p>
      <Show when={declared().length > 0} fallback={<p>{text.say('search.undeclared')}</p>}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setFollow(undefined)
          }}
        >
          <For each={declared()}>
            {(declaredParam) => (
              <input
                aria-label={declaredParam.name}
                placeholder={declaredParam.name}
                value={query[declaredParam.name] ?? ''}
                onChange={(event) => {
                  setFollow(undefined)
                  setQuery({ [declaredParam.name]: event.currentTarget.value || undefined })
                }}
              />
            )}
          </For>
          <button type="submit">{text.say('search.run')}</button>
        </form>
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
            <Show when={entriesOf(found().bundle).length > 0} fallback={<p>{text.say('search.none')}</p>}>
              <table>
                <tbody>
                  <For each={entriesOf(found().bundle)}>
                    {(resource) => (
                      <tr>
                        <td>
                          <A href={`/type/${resource.resourceType}/${resource.id ?? ''}`}>{resource.id}</A>
                        </td>
                        <td>{displayOf(resource)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </>
        )}
      </Show>
    </section>
  )
}
