const title = document.getElementById('state-title')
const detail = document.getElementById('state-detail')
const feedback = document.getElementById('feedback')
const armButton = document.getElementById('arm')
const copyTokenButton = document.getElementById('copy-token')
const copyCookieButton = document.getElementById('copy-cookie')
const clearButton = document.getElementById('clear')

let currentState = { status: 'idle', armed: false, captured: null }

function send(type) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(response)
    })
  })
}

function render(state) {
  currentState = state || { status: 'idle', armed: false, captured: null }
  const captured = currentState.captured
  copyTokenButton.disabled = !captured?.token
  copyCookieButton.disabled = !captured?.cookies
  clearButton.disabled = !captured && !currentState.armed
  clearButton.textContent = currentState.armed ? 'Cancel capture' : 'Clear captured credentials'
  armButton.disabled = Boolean(currentState.armed)
  armButton.textContent = currentState.armed ? 'Capture is armed' : 'Arm one-shot capture'

  if (currentState.status === 'armed') {
    title.textContent = 'Waiting for one request'
    detail.textContent = 'Send a message on chat.deepseek.com within 2 minutes.'
  } else if (currentState.status === 'captured') {
    title.textContent = 'Credentials captured locally'
    detail.textContent = 'Use the buttons below to copy each value into your Account Pool form.'
  } else if (currentState.status === 'expired') {
    title.textContent = 'Capture expired'
    detail.textContent = 'Arm again, then send a message on chat.deepseek.com within 2 minutes.'
  } else {
    title.textContent = 'Ready when you are'
    detail.textContent = 'Arm first, then send a message while signed in to chat.deepseek.com.'
  }
}

async function refreshState() {
  try {
    render(await send('GET_STATE'))
  } catch {
    title.textContent = 'Could not read capture status'
    detail.textContent = 'Close and reopen this extension popup, then try again.'
  }
}

armButton.addEventListener('click', async () => {
  feedback.textContent = ''
  try {
    render(await send('ARM_CAPTURE'))
  } catch {
    feedback.textContent = 'Could not arm capture. Please reopen the popup.'
  }
})

copyTokenButton.addEventListener('click', async () => {
  const token = currentState.captured?.token
  if (!token) return
  try {
    await navigator.clipboard.writeText(token)
    feedback.textContent = 'Token copied. Paste it only into your local DS2API account form.'
  } catch {
    feedback.textContent = 'Clipboard access failed. Reopen the popup and try again.'
  }
})

copyCookieButton.addEventListener('click', async () => {
  const cookies = currentState.captured?.cookies
  if (!cookies) return
  try {
    await navigator.clipboard.writeText(cookies)
    feedback.textContent = 'Cookie header copied. Paste it only into your local DS2API account form.'
  } catch {
    feedback.textContent = 'Clipboard access failed. Reopen the popup and try again.'
  }
})

clearButton.addEventListener('click', async () => {
  const wasArmed = currentState.armed
  feedback.textContent = ''
  try {
    render(await send('CLEAR_CAPTURE'))
    feedback.textContent = wasArmed
      ? 'Capture canceled.'
      : 'Captured credentials cleared from the extension session.'
  } catch {
    feedback.textContent = 'Could not clear capture data. Please reopen the popup.'
  }
})

refreshState()
setInterval(refreshState, 1000)
