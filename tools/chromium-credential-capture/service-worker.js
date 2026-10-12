const CHAT_ORIGIN = 'https://chat.deepseek.com'
const STATE_KEY = 'captureState'
const CAPTURE_WINDOW_MS = 2 * 60 * 1000
let captureInProgress = false

const idleState = () => ({ status: 'idle', armed: false, armedAt: 0, captured: null })

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })

function getState(sendResponse) {
  chrome.storage.session.get(STATE_KEY, (result) => {
    let state = result[STATE_KEY] || idleState()
    if (state.armed && Date.now() - state.armedAt > CAPTURE_WINDOW_MS) {
      state = { ...state, status: 'expired', armed: false }
      chrome.storage.session.set({ [STATE_KEY]: state }, () => sendResponse(state))
      return
    }
    sendResponse(state)
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false

  if (message?.type === 'GET_STATE') {
    getState(sendResponse)
    return true
  }

  if (message?.type === 'ARM_CAPTURE') {
    const state = {
      status: 'armed',
      armed: true,
      armedAt: Date.now(),
      captured: null,
    }
    chrome.storage.session.set({ [STATE_KEY]: state }, () => sendResponse(state))
    return true
  }

  if (message?.type === 'CLEAR_CAPTURE') {
    const state = idleState()
    chrome.storage.session.set({ [STATE_KEY]: state }, () => sendResponse(state))
    return true
  }

  return false
})

function isDeepSeekPage(url) {
  if (!url) return false
  try {
    return new URL(url).origin === CHAT_ORIGIN
  } catch {
    return false
  }
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.tabId < 0 || details.method !== 'POST' || captureInProgress) return
    if (!isDeepSeekPage(details.documentUrl) && !isDeepSeekPage(details.initiator)) return

    const headers = details.requestHeaders || []
    const authorization = headers.find((header) => header.name.toLowerCase() === 'authorization')?.value
    const cookie = headers.find((header) => header.name.toLowerCase() === 'cookie')?.value
    if (!authorization || !cookie) return

    captureInProgress = true
    chrome.storage.session.get(STATE_KEY, (result) => {
      const current = result[STATE_KEY] || idleState()
      if (!current.armed) {
        captureInProgress = false
        return
      }

      if (Date.now() - current.armedAt > CAPTURE_WINDOW_MS) {
        const expired = { ...current, status: 'expired', armed: false }
        chrome.storage.session.set({ [STATE_KEY]: expired }, () => {
          captureInProgress = false
        })
        return
      }

      const token = authorization.replace(/^\s*Bearer\s+/i, '').trim()
      if (!token) {
        captureInProgress = false
        return
      }

      const state = {
        status: 'captured',
        armed: false,
        armedAt: current.armedAt,
        captured: {
          token,
          cookies: cookie.trim(),
          capturedAt: Date.now(),
        },
      }
      chrome.storage.session.set({ [STATE_KEY]: state }, () => {
        captureInProgress = false
      })
    })
  },
  { urls: [`${CHAT_ORIGIN}/api/*`] },
  ['requestHeaders', 'extraHeaders'],
)
