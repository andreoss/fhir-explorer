import { createServer } from 'vite'

export async function startApp() {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    logLevel: 'error'
  })

  await server.listen()

  const address = server.httpServer?.address()

  if (address === null || typeof address !== 'object') {
    throw new Error('the development server announced no address')
  }

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    stop: async () => {
      await server.close()
    }
  }
}
