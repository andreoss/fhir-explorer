import { momentOf } from '../domain/fhir/moment'
import type { TextKey } from '../i18n'
import type { Text } from './text'

export function saidOfType(text: Text, key: TextKey, type: string): string {
  return text.say(key).replace('{type}', type)
}

export function saidValue(text: Text, said: string, truth: boolean | undefined): string {
  if (truth !== undefined) {
    return text.say(truth ? 'value.yes' : 'value.no')
  }

  const moment = momentOf(said)

  if (moment === undefined) {
    return said
  }

  return new Intl.DateTimeFormat(
    text.language(),
    moment.timed
      ? { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }
      : { dateStyle: 'medium', timeZone: 'UTC' }
  ).format(moment.at)
}
