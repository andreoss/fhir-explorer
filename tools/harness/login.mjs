function cookiesOf(answer, carried) {
  const jar = new Map(carried)

  for (const value of answer.headers.getSetCookie()) {
    const pair = value.split(';')[0]
    const at = pair.indexOf('=')

    if (at > 0) {
      jar.set(pair.slice(0, at), pair.slice(at + 1))
    }
  }

  return jar
}

function header(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

export async function loginThrough(authorizeUrl, username, password) {
  const page = await fetch(authorizeUrl, { redirect: 'manual' })
  const jar = cookiesOf(page, new Map())
  const html = await page.text()
  const action = /action="([^"]+)"/.exec(html)?.[1]?.replaceAll('&amp;', '&')

  if (action === undefined) {
    throw new Error('the issuer answered no form to sign in with')
  }

  const answer = await fetch(action, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: header(jar)
    },
    body: new URLSearchParams({ username, password, credentialId: '' }).toString()
  })

  const back = answer.headers.get('location')

  if (back === null) {
    throw new Error(`the issuer did not send the browser back: ${String(answer.status)}`)
  }

  return Object.fromEntries(new URL(back).searchParams.entries())
}
