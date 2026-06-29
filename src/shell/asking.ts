import type { Result } from '@lib/transport'
import type { Troubles } from './errors'

export function gotFrom<T>(troubles: Troubles, at: string, answer: Result<T>): T | undefined {
  if (answer.ok) {
    return answer.value
  }

  troubles.report(at, answer.error.message)

  return undefined
}
