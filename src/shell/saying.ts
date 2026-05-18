import type { Text } from './text'

export function saidTruth(text: Text, said: string, truth: boolean | undefined): string {
  if (truth === undefined) {
    return said
  }

  return text.say(truth ? 'value.yes' : 'value.no')
}
