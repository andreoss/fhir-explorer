import type { JSX } from 'solid-js'
import { A, useParams } from '@solidjs/router'
import { Show, createResource } from 'solid-js'
import type { Resource } from '@lib/fhir'
import { useConnection } from '../server'
import { gotFrom } from '../asking'
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

      const got = gotFrom(troubles, `${wanted.type}/${wanted.id}`, answer)

      if (got === undefined) {
        return undefined
      }

      return got.resource
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
