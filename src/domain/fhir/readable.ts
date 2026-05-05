const SPLIT = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[a-zA-Z])(?=[0-9])/g

export function readable(name: string): string {
  const said = name
    .replace(/\[x]$/, '')
    .split('.')
    .pop()

  if (said === undefined || said.length === 0) {
    return name
  }

  const words = said.replace(SPLIT, ' ').toLowerCase()

  return `${words.slice(0, 1).toUpperCase()}${words.slice(1)}`
}

export function shortId(reference: string): string {
  const [type, id] = reference.split('/')

  if (type === undefined || id === undefined) {
    return reference
  }

  return id.length > 12 ? `${type}/${id.slice(0, 8)}…` : reference
}
