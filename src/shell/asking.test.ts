import { describe, expect, it } from 'vitest'
import { failed, ok } from '@lib/transport'
import type { Troubles } from './errors'
import { gotFrom } from './asking'

function recorder() {
  const reported: string[] = []
  const resolved: string[] = []

  const troubles = {
    all: () => [],
    said: () => [],
    report: (at: string) => {
      reported.push(at)
    },
    resolve: (at: string) => {
      resolved.push(at)
    },
    announce: () => undefined,
    dismiss: () => undefined,
    clear: () => undefined
  } as unknown as Troubles

  return { troubles, reported, resolved }
}

describe('what a view does with an answer', () => {
  it('reports what was refused, against the thing that was asked for', () => {
    const held = recorder()

    const got = gotFrom(held.troubles, 'Patient/p1', failed({ kind: 'status', message: 'gone', status: 404, issues: [] }))

    expect(got).toBeUndefined()
    expect(held.reported).toEqual(['Patient/p1'])
    expect(held.resolved).toEqual([])
  })

  it('takes the trouble back when the same thing works', () => {
    const held = recorder()

    const got = gotFrom(held.troubles, 'Patient/p1', ok('read'))

    expect(got).toBe('read')
    expect(held.resolved).toEqual(['Patient/p1'])
    expect(held.reported).toEqual([])
  })
})
