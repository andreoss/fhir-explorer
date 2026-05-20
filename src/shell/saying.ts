import type { TextKey } from '../i18n'
import type { Text } from './text'

export function saidOfType(text: Text, key: TextKey, type: string): string {
  return text.say(key).replace('{type}', type)
}

export function saidTruth(text: Text, said: string, truth: boolean | undefined): string {
  if (truth === undefined) {
    return said
  }

  return text.say(truth ? 'value.yes' : 'value.no')
}
