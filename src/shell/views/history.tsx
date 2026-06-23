import type { JSX } from 'solid-js'
import { A, useParams } from '@solidjs/router'
import { For, Show, createResource } from 'solid-js'
import { entriesOf } from '../../domain/transport'
import type { Resource } from '../../domain/fhir'
import { Busy, Empty } from '../states'
import { useConnection } from '../server'
import { useTroubles } from '../errors'
import { gotFrom } from '../asking'
import { saidValue } from '../saying'
import { useText } from '../text'

export function HistoryView(): JSX.Element {
  const params = useParams<{ type: string; id: string }>()
  const connection = useConnection()
  const troubles = useTroubles()
  const text = useText()

  const [versions] = createResource(
    () => ({ type: params.type, id: params.id, client: connection.client() }),
    async (wanted): Promise<readonly Resource[] | undefined> => {
      if (wanted.client === undefined) {
        return undefined
      }

      const answer = await wanted.client.history(wanted.type, wanted.id)

      const got = gotFrom(troubles, `${wanted.type}/${wanted.id}`, answer)

      if (got === undefined) {
        return undefined
      }

      return entriesOf(got.resource)
    }
  )

  return (
    <section class="page">
      <h1>{text.say('resource.history')}</h1>
      <p class="status">
        <span>
          {params.type}/{params.id}
        </span>
        <A href={`/type/${params.type}/${params.id}`}>{text.say('resource.rendered')}</A>
      </p>
      <Busy when={versions.loading} />
      <Show when={versions()} fallback={<Empty say="search.none" />}>
        {(found) => (
          <div class="scrolls">
            <table>
            <thead>
              <tr>
                <th>{text.say('history.version')}</th>
                <th>{text.say('history.changed')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <For each={found()}>
                {(resource, at) => (
                  <tr>
                    <td>
                      <A href={`/type/${params.type}/${params.id}/version/${resource.meta?.versionId ?? ''}`}>
                        {resource.meta?.versionId ?? '-'}
                      </A>
                    </td>
                    <td>{saidValue(text, resource.meta?.lastUpdated ?? '', undefined)}</td>
                    <td>
                      <Show when={at() === 0}>
                        <span class="fact" data-testid="current">
                          {text.say('history.current')}
                        </span>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
            </table>
          </div>
        )}
      </Show>
    </section>
  )
}
