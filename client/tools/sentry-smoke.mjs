import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, '..', 'src', 'instrument.js'), 'utf8')
for (const marker of ['enabled: Boolean(dsn)', 'headers: undefined', 'cookies: undefined']) {
  assert.ok(source.includes(marker), `Missing Sentry privacy marker: ${marker}`)
}
assert.ok(!source.includes('event.request.data = event.request.data'), 'Raw request data must not be forwarded by default')
console.log('Client Sentry privacy smoke passed')
