const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

const workerSource = fs.readFileSync(path.join(__dirname, 'service-worker.js'), 'utf8')
const popupSource = fs.readFileSync(path.join(__dirname, 'popup.js'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'))

function createHarness() {
  const store = {}
  const events = {}
  const makeEvent = (name) => ({
    addListener(listener) {
      events[name] = listener
    },
  })
  const chrome = {
    runtime: {
      id: 'test-extension-id',
      onInstalled: makeEvent('onInstalled'),
      onMessage: makeEvent('onMessage'),
    },
    storage: {
      session: {
        setAccessLevel() {},
        get(key, callback) {
          callback({ [key]: store[key] })
        },
        set(values, callback) {
          Object.assign(store, values)
          callback?.()
        },
      },
    },
    webRequest: {
      onBeforeSendHeaders: makeEvent('onBeforeSendHeaders'),
    },
  }
  vm.runInNewContext(workerSource, { chrome, URL, Date })

  return {
    store,
    send(type) {
      let response
      const keepAlive = events.onMessage({ type }, { id: chrome.runtime.id }, (value) => {
        response = value
      })
      assert.equal(keepAlive, true)
      return response
    },
    request(details) {
      events.onBeforeSendHeaders(details)
    },
  }
}

const request = (overrides = {}) => ({
  tabId: 7,
  method: 'POST',
  url: 'https://chat.deepseek.com/api/v0/chat/completion',
  documentUrl: 'https://chat.deepseek.com/',
  requestHeaders: [
    { name: 'Authorization', value: 'Bearer test-token' },
    { name: 'Cookie', value: 'session=test-cookie; cf_clearance=test-clearance' },
  ],
  ...overrides,
})

test('extension permissions stay scoped to the DeepSeek chat origin', () => {
  assert.deepEqual(manifest.host_permissions, ['https://chat.deepseek.com/*'])
  assert.equal(manifest.manifest_version, 3)
  assert.ok(manifest.permissions.includes('webRequest'))
  assert.ok(!manifest.permissions.includes('cookies'))
  assert.doesNotMatch(workerSource, /\\b(fetch|XMLHttpRequest)\\b/)
  assert.doesNotMatch(popupSource, /\\b(fetch|XMLHttpRequest)\\b/)
})

test('captures one matching request only after the user arms it', () => {
  const harness = createHarness()
  assert.equal(harness.send('GET_STATE').status, 'idle')
  harness.request(request())
  assert.equal(harness.store.captureState, undefined)

  assert.equal(harness.send('ARM_CAPTURE').status, 'armed')
  harness.request(request({ documentUrl: 'https://example.invalid/' }))
  assert.equal(harness.store.captureState.status, 'armed')

  harness.request(request())
  assert.equal(harness.store.captureState.status, 'captured')
  assert.equal(harness.store.captureState.captured.token, 'test-token')
  assert.equal(harness.store.captureState.captured.cookies, 'session=test-cookie; cf_clearance=test-clearance')

  harness.request(request({ requestHeaders: [
    { name: 'Authorization', value: 'Bearer another-token' },
    { name: 'Cookie', value: 'session=another-cookie' },
  ] }))
  assert.equal(harness.store.captureState.captured.token, 'test-token')
})

test('ignores requests without both credential headers and supports clearing', () => {
  const harness = createHarness()
  harness.send('ARM_CAPTURE')
  harness.request(request({ requestHeaders: [{ name: 'Authorization', value: 'Bearer test-token' }] }))
  assert.equal(harness.store.captureState.status, 'armed')

  assert.equal(harness.send('CLEAR_CAPTURE').status, 'idle')
  assert.equal(harness.store.captureState.captured, null)
})
