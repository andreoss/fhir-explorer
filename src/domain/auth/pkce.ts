const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

function bytes(size: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(size))
}

function base64url(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer)
  let binary = ''

  for (const byte of view) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function createVerifier(size = 64): string {
  return [...bytes(size)].map((byte) => UNRESERVED[byte % UNRESERVED.length] ?? '-').join('')
}

export function randomState(size = 16): string {
  return base64url(bytes(size).buffer as ArrayBuffer)
}

export async function challengeOf(verifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))

  return base64url(digest)
}
