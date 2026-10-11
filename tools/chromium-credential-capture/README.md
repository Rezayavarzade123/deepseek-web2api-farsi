# Local DeepSeek credential capture helper

This optional Chromium extension makes adding **your own signed-in DeepSeek account** to DS2API quicker. It captures one outgoing `Authorization` and `Cookie` header pair from `chat.deepseek.com` only after you explicitly arm it.

## Privacy and permissions

- The extension has host access only to `https://chat.deepseek.com/*` and observes only matching `/api/` POST requests from a `chat.deepseek.com` tab.
- It does not make network requests, transmit credentials to DS2API, or log credential values.
- A capture is kept in Chrome's temporary `storage.session` area. It is not synced; it is cleared when the browser session ends, the extension is reloaded, or you press **Clear captured credentials**.
- The popup never displays the raw values. It copies the token or full Cookie header only when you press the corresponding button.
- The browser will ask you to grant access to `chat.deepseek.com`. Review this source before loading the unpacked extension. Do not install credential tools from people or sites you do not trust.

## Install in Chrome, Edge, or Brave

1. Download or clone this repository from a source you trust.
2. Open `chrome://extensions` (or the browser's equivalent) and turn on **Developer mode**.
3. Choose **Load unpacked** and select this `tools/chromium-credential-capture` folder.
4. Sign in to [chat.deepseek.com](https://chat.deepseek.com).
5. Open the extension popup and select **Arm one-shot capture**.
6. Within two minutes, send a message in the DeepSeek chat tab. The helper captures the first matching API POST that contains both headers.
7. Reopen the popup. Select **Copy token** and **Copy Cookie header**, then paste them into the matching fields in **DS2API → Account Pool → Add account**.
8. Press **Clear captured credentials** when finished. This does not clear your operating system's clipboard; replace or clear copied values there as needed.

The extension captures request headers, not browser storage, and cannot recover credentials from requests that happened before you armed it. If the current DeepSeek web app changes its request format, use the Network-panel instructions in the project README instead. This helper does not establish that the private upstream protocol is currently compatible.

Treat both values like passwords. Use only your own account and never paste them into an issue, pull request, chat, screenshot, or public file. Revoke or refresh them if exposed.

## Test the helper

With Node.js 18 or newer, run the local permission and one-shot-capture tests:

```bash
node --test test-capture.js
```
