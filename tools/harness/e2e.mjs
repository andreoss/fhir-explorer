import { withBrowser } from './browser.mjs'

process.exit(await withBrowser('pnpm', ['exec', 'playwright', 'test', ...process.argv.slice(2)]))
