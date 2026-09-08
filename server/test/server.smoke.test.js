const { spawn } = require('node:child_process')
const path = require('node:path')
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')

const serverRoot = path.resolve(__dirname, '..')
const port = 5090 + Math.floor(Math.random() * 100)
const baseUrl = `http://127.0.0.1:${port}`
let serverProcess

async function request(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: 'application/json' },
  })
  const body = await response.json()
  return { response, body }
}

before(async () => {
  serverProcess = spawn(process.execPath, ['index.js'], {
    cwd: serverRoot,
    env: { ...process.env, PORT: String(port), SENTRY_DSN: '', SENTRY_ENVIRONMENT: 'test' },
    stdio: 'ignore',
  })

  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Server exited before becoming ready with code ${serverProcess.exitCode}`)
    }
    try {
      const { response } = await request('/healthz')
      if (response.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error('Server did not become ready within 15 seconds')
})

after(() => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill()
  }
})

test('healthz returns a non-sensitive service summary', async () => {
  const { response, body } = await request('/healthz')
  assert.equal(response.status, 200)
  assert.equal(body.status, 'ok')
  assert.equal(body.service, 'seraphyn-api')
  assert.equal(typeof body.timestamp, 'string')
  assert.equal(JSON.stringify(body).includes('SUPABASE_SECRET_KEY'), false)
})

test('readiness returns a structured configuration result', async () => {
  const { response, body } = await request('/api/ready')
  assert.ok([200, 503].includes(response.status))
  assert.ok(['ok', 'error'].includes(body.status))
  if (response.status === 503) {
    assert.ok(Array.isArray(body.missingEnv))
    assert.equal(JSON.stringify(body).includes('SUPABASE_SERVICE_KEY'), false)
  }
})



test('protected admin route rejects an unauthenticated request', async () => {
  const { response, body } = await request('/api/admin')
  assert.equal(response.status, 401)
  assert.equal(typeof body.error, 'string')
})

