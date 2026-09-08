const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const assert = require('node:assert/strict')

let supabaseUserResult = { data: { user: null }, error: null }
const originalLoad = Module._load
Module._load = function loadWithAuthStubs(request, parent, isMain) {
  if (request === '../config/supabase') {
    return { supabase: { auth: { getUser: async () => supabaseUserResult } } }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const { requireAuth, requireRole, requireApproved } = require(path.resolve(__dirname, '../middleware/auth'))
Module._load = originalLoad

function responseRecorder() {
  const result = { statusCode: 200, body: null }
  const res = {
    status(code) {
      result.statusCode = code
      return res
    },
    json(body) {
      result.body = body
      return res
    },
  }
  return { res, result }
}

test('requireAuth rejects a request without a bearer token', async () => {
  const { res, result } = responseRecorder()
  let nextCalled = false
  await requireAuth({ headers: {} }, res, () => { nextCalled = true })
  assert.equal(result.statusCode, 401)
  assert.equal(typeof result.body.error, 'string')
  assert.equal(nextCalled, false)
})

test('requireAuth rejects an invalid JWT without exposing provider details', async () => {
  supabaseUserResult = { data: { user: null }, error: new Error('provider detail') }
  const { res, result } = responseRecorder()
  let nextCalled = false
  await requireAuth({ headers: { authorization: 'Bearer malformed-test-token' } }, res, () => { nextCalled = true })
  assert.equal(result.statusCode, 401)
  assert.equal(typeof result.body.error, 'string')
  assert.equal(result.body.error.includes('provider detail'), false)
  assert.equal(nextCalled, false)
})

test('requireRole rejects a disallowed role and permits an allowed role', () => {
  const reject = responseRecorder()
  let rejectedNext = false
  requireRole('admin')({ user: { role: 'nurse' } }, reject.res, () => { rejectedNext = true })
  assert.equal(reject.result.statusCode, 403)
  assert.equal(typeof reject.result.body.error, 'string')
  assert.equal(rejectedNext, false)

  const allow = responseRecorder()
  let allowedNext = false
  requireRole('admin', 'nurse')({ user: { role: 'nurse' } }, allow.res, () => { allowedNext = true })
  assert.equal(allow.result.statusCode, 200)
  assert.equal(allowedNext, true)
})

test('requireApproved rejects a pending account and permits an approved account', () => {
  const pending = responseRecorder()
  let pendingNext = false
  requireApproved({ user: { status: 'pending' } }, pending.res, () => { pendingNext = true })
  assert.equal(pending.result.statusCode, 403)
  assert.equal(pending.result.body.error, 'Account pending approval')
  assert.equal(pendingNext, false)

  const approved = responseRecorder()
  let approvedNext = false
  requireApproved({ user: { status: 'approved' } }, approved.res, () => { approvedNext = true })
  assert.equal(approved.result.statusCode, 200)
  assert.equal(approvedNext, true)
})

