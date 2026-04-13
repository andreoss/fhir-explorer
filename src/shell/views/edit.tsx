import type { JSX } from 'solid-js'
import { useNavigate, useParams } from '@solidjs/router'
import { For, Show, createResource, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { Field, Trouble } from '../../domain/form/model'
import { formOf, troublesFromServer, troublesIn } from '../../domain/form/model'
import type { Json, Resource } from '../../domain/fhir/types'
import type { Editing, Steps } from './fields'
import { FieldView } from './fields'
import { useConnection } from '../server'
import { useTroubles } from '../errors'
import { useText } from '../text'

type Held = {
  readonly resource: Resource
  readonly versionId?: string
  readonly fields: readonly Field[]
}

function parsed(written: string): Resource | undefined {
  try {
    const value: unknown = JSON.parse(written)

    return typeof value === 'object' && value !== null ? (value as Resource) : undefined
  } catch {
    return undefined
  }
}

export function EditView(props: { readonly making?: boolean }): JSX.Element {
  const params = useParams<{ type: string; id?: string }>()
  const connection = useConnection()
  const troubles = useTroubles()
  const text = useText()
  const navigate = useNavigate()

  const [written, setWritten] = createSignal('')
  const [wrong, setWrong] = createStore<{ found: readonly Trouble[] }>({ found: [] })
  const [dirty, setDirty] = createSignal(false)
  const [loaded, setLoaded] = createSignal('')
  const [saving, setSaving] = createSignal(false)

  const [held] = createResource(
    () => ({
      type: params.type,
      id: params.id,
      making: props.making === true,
      client: connection.client(),
      catalogue: connection.catalogue()
    }),
    async (wanted): Promise<Held | undefined> => {
      if (wanted.client === undefined) {
        return undefined
      }

      const described = await wanted.catalogue?.definition(wanted.type)
      const fields = described?.ok === true ? formOf(described.value) : []

      if (wanted.making || wanted.id === undefined) {
        const empty: Resource = { resourceType: wanted.type }

        setWritten(JSON.stringify(empty, null, 2))
        setLoaded('')

        return { resource: empty, fields }
      }

      const answer = await wanted.client.read(wanted.type, wanted.id)

      if (!answer.ok) {
        troubles.report(`${wanted.type}/${wanted.id}`, answer.error.message)
        return undefined
      }

      setWritten(JSON.stringify(answer.value.resource, null, 2))
      setLoaded(JSON.stringify(answer.value.resource, null, 2))

      return {
        resource: answer.value.resource,
        ...(answer.value.versionId === undefined ? {} : { versionId: answer.value.versionId }),
        fields
      }
    }
  )

  function edited(): Resource | undefined {
    return parsed(written())
  }

  function change(steps: Steps, value: Json | undefined): void {
    const resource = edited()

    if (resource === undefined) {
      return
    }

    const changed = structuredClone(resource) as Record<string, unknown>
    let held: Record<string, unknown> | unknown[] = changed

    steps.forEach((step, at) => {
      if (at === steps.length - 1) {
        if (Array.isArray(held) && typeof step === 'number') {
          held[step] = value
        } else if (!Array.isArray(held) && typeof step === 'string') {
          held[step] = value
        }

        return
      }

      const next = steps[at + 1]
      const empty: Record<string, unknown> | unknown[] = typeof next === 'number' ? [] : {}

      if (Array.isArray(held) && typeof step === 'number') {
        held[step] = (held[step]) ?? empty
        held = held[step] as Record<string, unknown> | unknown[]

        return
      }

      if (!Array.isArray(held) && typeof step === 'string') {
        held[step] = held[step] ?? empty
        held = held[step] as Record<string, unknown> | unknown[]
      }
    })

    setDirty(true)
    setWritten(JSON.stringify(changed, null, 2))
  }

  function at(steps: Steps): Json | undefined {
    let held: unknown = edited()

    for (const step of steps) {
      if (typeof held !== 'object' || held === null) {
        return undefined
      }

      held = (held as Record<string | number, unknown>)[step]
    }

    return held as Json | undefined
  }

  async function save(): Promise<void> {
    const client = connection.client()
    const resource = edited()
    const found = held()

    if (client === undefined || found === undefined) {
      return
    }

    if (resource === undefined) {
      setWrong('found', [{ path: '', message: text.say('error.title') }])
      return
    }

    const before = troublesIn(found.fields, resource, params.type)

    if (before.length > 0) {
      setWrong('found', before)
      return
    }

    setSaving(true)

    const answer =
      props.making === true
        ? await client.create(resource)
        : await client.update(
            resource,
            found.versionId === undefined ? undefined : { versionId: found.versionId }
          )

    setSaving(false)

    if (!answer.ok) {
      setWrong('found', troublesFromServer(answer.error.issues))
      troubles.report(params.type, answer.error.message)
      return
    }

    setDirty(false)
    setWrong('found', [])
    navigate(`/type/${params.type}/${answer.value.resource.id ?? params.id ?? ''}`)
  }

  async function remove(): Promise<void> {
    const client = connection.client()

    if (client === undefined || params.id === undefined) {
      return
    }

    const answer = await client.remove(params.type, params.id)

    if (!answer.ok) {
      troubles.report(params.type, answer.error.message)
      return
    }

    setDirty(false)
    navigate(`/type/${params.type}`)
  }

  function saidAbout(path: string): string | undefined {
    return wrong.found.find((trouble) => trouble.path === path)?.message
  }

  const editing: Editing = { at, change, said: saidAbout }

  return (
    <section class="page">
      <h1>
        {params.type} {props.making === true ? text.say('form.create') : text.say('form.update')}
      </h1>
      <Show when={held()}>
        {(found) => (
          <>
            <Show when={found().fields.length > 0} fallback={<p class="quiet">{text.say('resource.undescribed')}</p>}>
              <ul class="elements">
                <For each={found().fields}>
                  {(field) => <FieldView field={field} steps={[field.name]} editing={editing} />}
                </For>
              </ul>
            </Show>
            <textarea
              aria-label={text.say('resource.raw')}
              rows="16"
              value={written()}
              onInput={(event) => {
                setDirty(true)
                setWritten(event.currentTarget.value)
              }}
            />
            <Show when={wrong.found.length > 0}>
              <ul class="pointing" data-testid="wrong">
                <For each={wrong.found}>
                  {(trouble) => (
                    <li class="trouble">
                      <span class="where">{trouble.path}</span>
                      <span>{trouble.message}</span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <p class="status">
              <button
                class="primary"
                type="button"
                disabled={saving() || (props.making !== true && written() === loaded())}
                onClick={() => void save()}
              >
                {props.making === true ? text.say('form.create') : text.say('form.update')}
              </button>
              <Show when={props.making !== true}>
                <button
                  type="button"
                  onClick={() => {
                    if (globalThis.confirm(text.say('form.confirm.delete'))) {
                      void remove()
                    }
                  }}
                >
                  {text.say('form.delete')}
                </button>
              </Show>
              <Show when={dirty()}>
                <span class="fact" data-testid="unsaved">
                  {text.say('form.unsaved')}
                </span>
              </Show>
            </p>
          </>
        )}
      </Show>
    </section>
  )
}
