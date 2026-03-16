import type { JSX } from 'solid-js'
import { A, useParams } from '@solidjs/router'
import { Show, createResource } from 'solid-js'
import type { Resource } from '../../domain/fhir/types'
import { useConnection } from '../server'
import { useTroubles } from '../errors'
import { useText } from '../text'

export function VersionView(): JSX.Element {
  const params = useParams<{ type: string; id: string; version: string }>()
  const connection = useConnection()
  const troubles = useTroubles()
  const text = useText()

  const [held] = createResource(
    () => ({ type: params.type, id: params.id, version: params.version, client: connection.client() }),
    async (wanted): Promise<Resource | undefined> => {
      if (wanted.client === undefined) {
        return undefined
      }

      const answer = await wanted.client.vread(wanted.type, wanted.id, wanted.version)

      if (!answer.ok) {
        troubles.report(`${wanted.type}/${wanted.id}`, answer.error.message)
        return undefined
      }

      return answer.value.resource
    }
  )

  return (
    <section class="page">
      <h1>
        {text.say('resource.version')} {params.version}
      </h1>
      <p class="status">
        <span>
          {params.type}/{params.id}
        </span>
        <A href={`/type/${params.type}/${params.id}/history`}>{text.say('resource.history')}</A>
      </p>
      <Show when={held()}>{(found) => <pre data-testid="raw">{JSON.stringify(found(), null, 2)}</pre>}</Show>
    </section>
  )
}
