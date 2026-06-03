import type { Json } from './types'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIMED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/

export type Moment = {
  readonly at: Date
  readonly timed: boolean
}

function dated(said: string, timed: boolean): Moment | undefined {
  const at = new Date(timed ? said : `${said}T00:00:00Z`)

  return Number.isNaN(at.getTime()) ? undefined : { at, timed }
}

export function momentOf(value: Json | undefined): Moment | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  if (DAY.test(value)) {
    return dated(value, false)
  }

  return TIMED.test(value) ? dated(value, true) : undefined
}
