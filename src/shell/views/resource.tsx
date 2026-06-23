import type { JSX } from 'solid-js'
import { A, useParams } from '@solidjs/router'
import { Show, createResource, createSignal } from 'solid-js'
import { displayOf } from '../../domain/fhir'
import type { TypeDefinition } from '../../domain/conformance'
import type { Resource } from '../../domain/fhir'
import { Elements } from './elements'
import { gotFrom } from '../asking'
import { Facts } from './facts'
import { Busy } from '../states'
import { useConnection } from '../server'
import { useTroubles } from '../errors'
import { useText } from '../text'
import { useTitle } from '../title'

type Held = {
  readonly resource: Resource
  readonly versionId?: string
  readonly lastModified?: string
  readonly definition: TypeDefinition | undefined
}

export function ResourceView(): JSX.Element {
  const params = useParams<{ type: string; id: string }>()
  const connection = useConnection()
  const troubles = useTroubles()
  const text = useText()
  const [raw, setRaw] = createSignal(false)
  const [copied, setCopied] = createSignal(false)

  async function copy(said: string): Promise<void> {
    try {
      await globalThis.navigator.clipboard.writeText(said)
      setCopied(true)
    } catch {
      troubles.report(params.type, text.say('resource.copy'))
    }
  }

  useTitle(() => {
    const found = held()

    return found === undefined ? params.type : displayOf(found.resource)
  })

  const [held] = createResource(
    () => ({ type: params.type, id: params.id, client: connection.client(), catalogue: connection.catalogue() }),
    async (wanted): Promise<Held | undefined> => {
      if (wanted.client === undefined) {
        return undefined
      }

      const answer = await wanted.client.read(wanted.type, wanted.id)

      const got = gotFrom(troubles, `${wanted.type}/${wanted.id}`, answer)

      if (got === undefined) {
        return undefined
      }

      const described = await wanted.catalogue?.definition(wanted.type)

      return {
        resource: got.resource,
        ...(got.versionId === undefined ? {} : { versionId: got.versionId }),
        ...(got.lastModified === undefined ? {} : { lastModified: got.lastModified }),
        definition: described?.ok === true && described.value.complete ? described.value : undefined
      }
    }
  )

  return (
    <section class="page">
      <Busy when={held.loading} />
      <Show when={held()}>
        {(found) => (
          <>
            <h1>{displayOf(found().resource)}</h1>
            <p class="status">
              <span>
                {params.type}/{params.id}
              </span>
              <span class="fact" data-testid="version">
                {text.say('resource.version')}: {found().versionId ?? '-'}
              </span>
              <Show when={found().lastModified}>
                {(when) => (
                  <span class="fact">
                    {text.say('resource.updated')}: {when()}
                  </span>
                )}
              </Show>
              <A class="action" href={`/graph/${params.type}/${params.id}`}>
                {text.say('resource.graph')}
              </A>
              <A class="action" href={`/type/${params.type}/${params.id}/history`}>
                {text.say('resource.history')}
              </A>
              <A class="action" href={`/type/${params.type}/${params.id}/edit`}>
                {text.say('resource.edit')}
              </A>
              <button
                class="action"
                type="button"
                onClick={() => {
                  setRaw((shown) => !shown)
                }}
              >
                {raw() ? text.say('resource.rendered') : text.say('resource.raw')}
              </button>
            </p>
            <section class="card" aria-label={text.say('resource.facts')} data-testid="facts">
              <Facts resource={found().resource} />
            </section>
            <Show when={found().definition === undefined}>
              <p class="quiet says">{text.say('resource.undescribed')}</p>
            </Show>
            <Show
              when={raw()}
              fallback={
                <Elements
                  resource={found().resource}
                  described={{ definition: found().definition, root: params.type }}
                />
              }
            >
              <>
                <button
                  class="small"
                  type="button"
                  onClick={() => {
                    void copy(JSON.stringify(found().resource, null, 2))
                  }}
                >
                  {copied() ? text.say('resource.copied') : text.say('resource.copy')}
                </button>
                <pre data-testid="raw">{JSON.stringify(found().resource, null, 2)}</pre>
              </>
            </Show>

          </>
        )}
      </Show>
    </section>
  )
}
