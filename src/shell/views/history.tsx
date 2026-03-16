import type { JSX } from 'solid-js'
import { A, useParams } from '@solidjs/router'
import { For, Show, createResource } from 'solid-js'
import { entriesOf } from '../../domain/transport/paging'
import type { Resource } from '../../domain/fhir/types'
import { useConnection } from '../server'
import { useTroubles } from '../errors'
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

      if (!answer.ok) {
        troubles.report(`${wanted.type}/${wanted.id}`, answer.error.message)
        return undefined
      }

      return entriesOf(answer.value.resource)
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
      <Show when={versions()} fallback={<p>{text.say('search.none')}</p>}>
        {(found) => (
          <table>
            <tbody>
              <For each={found()}>
                {(resource) => (
                  <tr>
                    <td>
                      <A href={`/type/${params.type}/${params.id}/version/${resource.meta?.versionId ?? ''}`}>
                        {resource.meta?.versionId ?? '-'}
                      </A>
                    </td>
                    <td>{resource.meta?.lastUpdated ?? ''}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        )}
      </Show>
    </section>
  )
}
