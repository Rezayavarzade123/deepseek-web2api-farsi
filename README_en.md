# DeepSeek Web Chat API Proxy

[English](README_en.md) · [فارسی](README_fa.md)

> An unofficial proxy that adapts the private `chat.deepseek.com` web-chat protocol to OpenAI-compatible and Anthropic-compatible endpoints.

**Important:** This project talks to DeepSeek's web application, not the official `api.deepseek.com` API. It uses a signed-in web account's token and cookies and solves the web client's proof-of-work challenge. The private protocol is undocumented and can change without notice. This project is not affiliated with DeepSeek; use it at your own risk and in compliance with DeepSeek's terms.

## DeepSeek model compatibility

As of **October 11, 2026**, DeepSeek's official API lists `deepseek-flash` as V4.1-Flash, with native vision support, and `deepseek-v4-pro` as V4-Pro-0813, which is text-only. The current [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/) page lists both; the [updated change log](https://api-docs.deepseek.com/updates/) says Pro API service continues after September 14, 2026, with billing unchanged. The legacy API IDs `deepseek-chat` and `deepseek-reasoner` were announced for retirement on July 24, 2026.

DeepSeek V4.1-Flash combines visual understanding with strong reasoning capabilities. The web app's quick, expert, and vision experience has been reported as unified into an adaptive mode ([AIbase report](https://www.aibase.com/news/30949)); this describes DeepSeek's product behavior, not a verified contract for its private web protocol.

This proxy exposes one default **local route alias**:

| Client model ID | Local route | Meaning inside this proxy |
|---|---|---|
| `deepseek-flash` | `default` | Default private web-chat route hint for the unified Flash experience |

`deepseek-flash` is not forwarded to `api.deepseek.com`, and the proxy cannot guarantee which upstream model or mode the web app selects. Although the upstream V4.1-Flash model supports vision, this proxy currently forwards text only; image upload/content conversion is not implemented. OpenAI-style non-text parts and Anthropic image blocks are rejected with HTTP 400 rather than silently dropped. Use DeepSeek's official API directly for image input or official API features.

The private web protocol cannot be live-validated in this environment because it requires a real account and access to DeepSeek. Offline tests verify local routing and compatibility behavior only.

---

## Features

- OpenAI-compatible `POST /v1/chat/completions` and `GET /v1/models`, including streaming.
- Anthropic-compatible `POST /v1/messages`, including streaming and tool-use blocks.
- Client API-key authentication (`Authorization: Bearer` or `x-api-key`).
- A default local web-chat route plus configurable legacy expert/thinking/search hints; their effect on the current private protocol is unverified.
- DSML prompt-based tool calling with streaming detection. Tool calling is best-effort, not native or guaranteed.
- Automatic proof-of-work solving, session management, and optional caller-scoped multi-turn session reuse.
- Multi-account pool with round-robin selection, health checks, and recovery.
- Per-key/per-IP rate limiting, usage statistics, and an admin dashboard.
- Optional Fernet encryption for stored account credentials.
- English and Persian (Farsi) WebUI language selector; Persian uses a right-to-left layout.
- Optional one-shot Chromium helper to copy your own DeepSeek chat token and Cookie header locally; see [the helper guide](tools/chromium-credential-capture/README.md).
- Per-user installer that adds the `ds2api` command to PATH without administrator rights.

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 20+ and npm to build the WebUI (optional if you only need the API)
- Network access to `chat.deepseek.com` and the private DeepSeek signature endpoints used by the adapter
- A valid DeepSeek account (free to register)

### Installation

#### Recommended: per-user installer

The installer needs Python 3.10+. It creates a virtual environment, installs Python dependencies, builds the WebUI when Node.js 20+ and npm are available, and adds `ds2api` to your **user** PATH. It does not require administrator rights.

##### Windows PowerShell

```powershell
git clone https://github.com/Rezayavarzade123/deepseek-web2api-free-test.git
Set-Location .\deepseek-web2api-free-test
py -3 .\scripts\install.py
$env:Path = "$env:LOCALAPPDATA\Programs\DS2API\bin;$env:Path"
ds2api
```

##### Windows Command Prompt

```bat
git clone https://github.com/Rezayavarzade123/deepseek-web2api-free-test.git
cd /d deepseek-web2api-free-test
py -3 scripts\install.py
set "PATH=%LOCALAPPDATA%\Programs\DS2API\bin;%PATH%"
ds2api
```

##### macOS / Linux

```bash
git clone https://github.com/Rezayavarzade123/deepseek-web2api-free-test.git
cd deepseek-web2api-free-test
python3 scripts/install.py
export PATH="$HOME/.local/bin:$PATH"
ds2api
```

The examples update the current shell's PATH so you can start the app immediately; later terminals can run `ds2api` directly from the installed user PATH. A new installation sets the local WebUI password to `admin` for convenience; change it before exposing DS2API to any network. The server refuses a public bind with this weak default. On Windows, the default install location is `%LOCALAPPDATA%\Programs\DS2API`; on macOS/Linux it is `${XDG_DATA_HOME:-~/.local/share}/ds2api`. The installer preserves `.env` and `data/` when rerun to update. If Node.js is not found, installation continues in API-only mode; install Node.js 20+ and rerun to build the WebUI. Pass `--skip-webui` to intentionally skip that build.

#### Open the WebUI

After `ds2api` reports that the server has started, open [http://127.0.0.1:8080/webui/](http://127.0.0.1:8080/webui/) in your browser and sign in with the default password `admin` (unless you changed `DEEPSEEK_ADMIN_PASSWORD` in `.env`). The `ds2api` command does not open a browser automatically. If you changed `PORT` in `.env`, use that port instead of `8080`.

To uninstall, run the system Python against the installed script (not the app's virtualenv): `py -3 "$env:LOCALAPPDATA\Programs\DS2API\scripts\uninstall.py"` in Windows PowerShell, or `python3 ~/.local/share/ds2api/scripts/uninstall.py` on macOS/Linux. It removes the PATH command and application files while preserving `.env` and `data/`. Add `--purge-user-data` only if you also want to delete stored settings and account credentials. If you chose a custom `--install-dir`, substitute that path.

#### Manual/source-checkout setup

If you prefer to run directly from the checkout, create a virtual environment and install dependencies:

```bash
python -m venv .venv
```

```bash
# macOS / Linux
. .venv/bin/activate
pip install -r requirements.txt
```

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

On Windows, `start.bat` can also create the environment, install missing dependencies, build the WebUI when possible, and start the server.

### Getting Your Credentials

You need to extract your DeepSeek credentials from the browser developer tools:

1. Open [chat.deepseek.com](https://chat.deepseek.com) in a browser and log in.
2. Press `F12` to open developer tools and switch to the **Network** tab.
3. Send any message on the page.
4. Click any request in the list (e.g. `chat/completion`).
5. Find the following two values in the request headers:

| Credential | Location | Example |
|------|------|------|
| Token | Value after `Bearer` in the `Authorization` header | Copy from the request headers |
| Cookies | Full value of the `Cookie` header | Copy from the request headers |

For Chrome, Edge, or Brave, the optional [one-shot credential helper](tools/chromium-credential-capture/README.md) can capture the next matching request after you explicitly arm it. It copies values only when you press a copy button; it does not upload them.

> Add credentials on the WebUI "Account Pool" page or store them in `data/accounts.json`. Account credentials are no longer read from `.env`.

### Configuration

The per-user installer creates `.env` with the local-test password `admin`. Change it to a strong, unique value before exposing the admin panel to any network. Do not overwrite the rest of that file. For a manual source-checkout setup only, create the template with:

```bash
cp .env.example .env
```

Edit the `.env` file:

```ini
# Create and revoke client API keys in WebUI > Settings.
# The full key is shown only once; the server stores only its hash.
ALLOW_UNAUTHENTICATED_API=false

# Change this to a strong, unique password before public deployment.
DEEPSEEK_ADMIN_PASSWORD=change-this-to-a-strong-password

# DeepSeek accounts are configured only in WebUI > Account Pool or data/accounts.json.

# The current default local route; this is a private web-chat hint, not an official API mapping.
MODEL_ROUTES={"deepseek-flash":"default"}

# Fallback client-facing model ID when a request omits "model".
MODEL_NAME=deepseek-flash

# Optional: listen address/port (default 127.0.0.1:8080)
HOST=127.0.0.1
PORT=8080

# Fallback for IDs not in MODEL_ROUTES. `expert` is a legacy private mode hint;
# its effect on the current unified upstream experience is unverified.
MODE=auto
THINKING=auto
SEARCH=auto
```

For the full list of variables, see `.env.example` and [AGENTS.md](AGENTS.md).

### Startup

After installing per-user, open a new terminal and run:

```bash
ds2api
```

For a source checkout on Windows, run `start.bat`. On macOS/Linux, start manually inside the virtual environment with:

```bash
.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8080
```

After startup, open `http://127.0.0.1:8080/webui/`. `start.bat` may open the browser automatically; the installed `ds2api` command does not. The terminal shows logs such as:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8080 (Press CTRL+C to quit)
```

### Verification

```bash
curl http://localhost:8080/health
# → {"status":"ok"}

curl http://localhost:8080/v1/models \
  -H "Authorization: Bearer ***"
# → {"object":"list","data":[
#      {"id":"deepseek-flash",...}   # local default route alias
#   ]}
```

### Admin Panel

The project ships a built-in web admin UI (React SPA since v3.0.0), providing request statistics and account pool management:

```
Open in browser: http://localhost:8080/webui/
```

> `start.bat` auto-builds the WebUI when needed (source in `webui-new/`, artifacts in `webui-new/dist/`). If Node.js/npm is unavailable, it starts the API without the UI. For manual builds, run `npm ci && npm run build` inside `webui-new/`.

Default password is `DEEPSEEK_ADMIN_PASSWORD` set in `.env` (defaults to `admin` if unset). Be sure to change the default password before public deployment.

By default, accounts are loaded from `data/accounts.json` (change the path with `ACCOUNT_STORE_PATH`). Changes made in the WebUI Account Pool page are saved to that file; you can also maintain the JSON file directly.

Other WebUI features include:

- **Overview** — live request statistics, latency charts, token estimates, and account-pool status.
- **Accounts** — add, edit, remove, inspect, and recheck account credentials.
- **Playground** — streaming test chat with model aliases, thinking, and web-search controls.
- **Settings** — create/revoke client API keys and inspect runtime configuration.
---

## Non-interactive Account Pool Configuration (for proxies / automation)

> For SDKs, scripts, curl, CI, and proxies that do **not** go through the WebUI panel. Account credentials are stored only in `data/accounts.json`; `.env` does not load account credentials. Maintain this file directly for non-interactive setups.

**Full `data/accounts.json` format (v1 plaintext):**

```json
{
  "version": 1,
  "accounts": [
    {"email": "acc-001", "token": "<token>", "cookies": "<cookies>"},
    {"email": "acc-002", "token": "<token>", "cookies": "<cookies>"}
  ]
}
```

- `token` + `cookies` are required; optional `email`/`id`/`created_at`/`updated_at`.
- `chmod 600` the file and `chmod 700` its directory (it holds plaintext DeepSeek credentials; leaking them means account abuse).
- The pool loads the file once at startup; restart the process after editing.
- **Encryption**: set `DEEPSEEK_ENCRYPTION_KEY` (Fernet); on first startup plaintext is migrated to encrypted v2 automatically, leaving `accounts.json.v1.bak`. Do not hand-write plaintext afterward.

**Non-interactive setup steps:**

```bash
# 1. Write the account pool file (can be script-generated)
cat > project_dir/data/accounts.json <<'JSON'
{"version":1,"accounts":[{"email":"acc-001","token":"<token>","cookies":"<cookies>"}]}
JSON
chmod 600 project_dir/data/accounts.json && chmod 700 project_dir/data

# 2. Configure API auth (required for non-interactive use, else /v1/* → 503)
#    After startup, log into the WebUI and create an API key in Settings.

# 3. Start
python -m uvicorn server:app --host 127.0.0.1 --port 8080
```

- **Change the store path**: `ACCOUNT_STORE_PATH` environment variable.

---

## API Documentation

### `POST /v1/chat/completions`

OpenAI-compatible chat completion endpoint.

#### Request Body

```json
{
  "model": "deepseek-flash",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false,
  "temperature": 0.7,
  "top_p": 0.95,
  "max_tokens": null,
  "thinking_mode": false,
  "search_enabled": false,
  "tools": null,
  "tool_choice": "auto"
}
```

| Parameter | Type | Default | Description |
|------|------|--------|------|
| `model` | `string` | `MODEL_NAME` | Client-facing route alias; the response echoes the requested ID. |
| `messages` | `array` | required | Message list with `system` / `user` / `assistant` / `tool` roles. Text only. |
| `stream` | `boolean` | `false` | Return OpenAI-style server-sent events. |
| `temperature` | `float` | `null` | Accepted for compatibility; not forwarded to the web client. |
| `top_p` | `float` | `null` | Accepted for compatibility; not forwarded. |
| `max_tokens` | `int` | `null` | Accepted for compatibility; not forwarded. |
| `thinking_mode` | `boolean` | `false` | Request a thinking/reasoning response where supported. |
| `search_enabled` | `boolean` | `false` | Request web search where supported. |
| `tools` | `array` | `null` | OpenAI-format definitions converted to best-effort DSML prompt instructions. |
| `tool_choice` | `string\|dict` | `null` | Used as a prompt hint; strict or forced tool selection is not guaranteed. |
| `user` | `string` | `null` | Optional stable caller identifier for multi-turn session reuse. |

#### Non-streaming response (`stream: false`)

```json
{
  "id": "chatcmpl-a1b2c3d4e5f6",
  "object": "chat.completion",
  "created": 1712345678,
  "model": "deepseek-flash",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 7,
    "total_tokens": 17
  }
}
```

The response echoes the requested `model` ID. OpenAI `usage` values are local estimates, not authoritative upstream billing counts. The proxy does not guarantee which underlying model a web-chat mode uses.

#### Streaming response (`stream: true`)

Standard OpenAI SSE format; each event is a line `data: {...}\n\n`, ending with `data: [DONE]\n\n`:

```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","model":"deepseek-flash","choices":[{"index":0,"delta":{},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","model":"deepseek-flash","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","model":"deepseek-flash","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

---

### `POST /v1/messages`

Anthropic Claude API-compatible chat completion endpoint.

#### Request Body

```json
{
  "model": "deepseek-flash",
  "max_tokens": 1024,
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "system": "You are a helpful assistant.",
  "stream": false,
  "thinking": {"type": "enabled", "budget_tokens": 16000},
  "tools": [
    {"name": "get_weather", "description": "Get weather", "input_schema": {"type": "object", "properties": {"city": {"type": "string"}}}}
  ]
}
```

| Parameter | Type | Default | Description |
|------|------|--------|------|
| `model` | `string` | client-supplied | Echoed in the response; use a configured local alias to select a route. |
| `messages` | `array` | required | Message list with `user` / `assistant` roles. Text only. |
| `system` | `string\|array` | `null` | System prompt. |
| `stream` | `boolean` | `false` | Return Anthropic-style server-sent events. |
| `thinking` | `object` | `null` | `{"type": "enabled"}` requests thinking where supported. |
| `tools` | `array` | `null` | Anthropic-format tool definitions, converted to best-effort DSML prompt instructions. |
| `max_tokens` | `int` | `null` | Accepted for compatibility; not forwarded to the web client. |
| `temperature`, `top_p` | number | `null` | Accepted for compatibility; not forwarded. |
| `metadata.user_id` | `string` | `null` | Optional caller identifier for multi-turn session reuse. Other metadata is ignored. |
| `stop_sequences` | `array` | `null` | Accepted but not forwarded. |

#### Non-streaming response (`stream: false`)

```json
{
  "id": "msg_xxxxxxxxxxxxxxxxxxxxxxxx",
  "type": "message",
  "role": "assistant",
  "content": [
    {"type": "text", "text": "Hello! How can I help you?"}
  ],
  "model": "deepseek-flash",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {"input_tokens": -1, "output_tokens": -1}
}
```

When a tool is called:

```json
"content": [
  {"type": "tool_use", "id": "toolu_xxx", "name": "get_weather", "input": {"city": "Beijing"}}
],
"stop_reason": "tool_use"
```

#### Streaming response (`stream: true`)

Native Anthropic SSE format, containing `message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop` events:

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_...","type":"message","role":"assistant","content":[],"model":"deepseek-flash","stop_reason":null,...}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"reasoning process..."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"reply content"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":-1}}

event: message_stop
data: {}
```

The response echoes the requested `model` ID. Anthropic usage is currently returned as `-1` because the private web protocol does not provide compatible token counts. The `MODE`, `THINKING`, and `SEARCH` settings affect both endpoints.

---

## Private web-chat mode hints

DeepSeek's current web experience is reported to combine the former quick, expert, and vision modes into one adaptive Flash experience. The proxy still accepts these environment settings and translates them into private request fields, but their current effect on DeepSeek's undocumented protocol has not been live-verified. They are not official API model selectors.

| Setting | Values | Proxy-side behavior |
|---|---|---|
| `MODE` | `auto` / `quick` / `expert` | `auto` / `quick` sends the `default` mode hint; `expert` sends the legacy `expert` hint. |
| `THINKING` | `auto` / `enabled` / `disabled` | `auto` respects the client request; the other values force the corresponding request flag. |
| `SEARCH` | `auto` / `enabled` / `disabled` | `auto` respects the client request where available; the other values force the corresponding request flag. |

A matching `MODEL_ROUTES` entry takes precedence over `MODE`. Per-route thinking/search overrides take precedence over their environment settings; when those settings are `auto`, the request fields are used. These describe what the proxy sends, not a guarantee about how the current upstream app responds.

---

## Reasoning / Thinking Output

If the upstream emits reasoning while thinking is enabled, the proxy exposes it in the `reasoning_content` field in streaming and non-streaming responses.

### Reasoning in streaming responses

When thinking is enabled and the upstream emits reasoning, the SSE stream may output reasoning fragments before the final answer:

```
data: {"id":"...","choices":[{"index":0,"delta":{"reasoning_content":""},"finish_reason":null}]}

data: {"id":"...","choices":[{"index":0,"delta":{"reasoning_content":"First"},"finish_reason":null}]}

data: {"id":"...","choices":[{"index":0,"delta":{"reasoning_content":"we"},"finish_reason":null}]}
...
data: {"id":"...","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"...","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}
...
data: {"id":"...","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}
data: [DONE]
```

Clients that understand the `reasoning_content` field can display the upstream reasoning output separately from the answer. If you do not want reasoning output, set `THINKING=disabled` or disable thinking in the matching route.

---

## Function Calling (Tool Calls)

This project simulates tool calls via **DSML (DeepSeek Markup Language)** prompt instructions. The upstream web protocol does not expose native function calling, so tool selection and argument validity are best-effort.

### How it works

1. The function definitions in the `tools` parameter are converted into a DSML-format system prompt.
2. The prompt guides the model to respond to tool calls in a specific XML format.
3. The `StreamSieve` engine detects DSML tags in real time from the SSE stream.
4. Matching tool calls are converted to OpenAI-format `tool_calls` and returned.

### Usage example

```python
import openai

client = openai.Client(base_url="http://localhost:8080/v1", api_key="***")

response = client.chat.completions.create(
    model="deepseek-flash",
    messages=[{"role": "user", "content": "What's the weather in Beijing?"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the weather for a given city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"}
                },
                "required": ["city"]
            }
        }
    }],
    tool_choice="auto",
)
```

### DSML format

DSML uses an XML-like tag structure. When the model decides to call a tool, the response format is:

```xml
<|DSML|tool_calls>
  <|DSML|invoke name="get_weather">
    <|DSML|parameter name="city"><![CDATA[Beijing]]></|DSML|parameter>
  </|DSML|invoke>
</|DSML|tool_calls>
```

The `StreamSieve` engine buffers possible DSML prefixes and captures a tool call once recognized. This reduces markup leakage but cannot guarantee that the model follows the requested format.

---

## Multi-turn sessions (v2.2.0)

The proxy provides lightweight multi-turn behavior by reusing an upstream `chat_session_id` and `parent_message_id` when DeepSeek's web endpoint accepts them:

- **Anthropic clients**: use the `metadata.user_id` field in the request body as the session stickiness key.
- **OpenAI clients**: use the custom HTTP header `X-Conversation-Id` or the top-level `user` field as the session key.
- **Isolation and account binding**: cached sessions are scoped to the caller and bound to the DeepSeek account that created them; an upstream session is never submitted with another account's credentials.
- **Without an explicit identifier**: sessions are not reused. The proxy never infers a key from the first message, since unrelated users often share the same opener.

The session cache TTL defaults to 1800 seconds (`SESSION_CACHE_TTL`); a new session starts automatically after expiry. Set `SESSION_CACHE_TTL=0` to fully disable multi-turn behavior.

```bash
# Turn 1
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Conversation-Id: user-42-session-7" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-flash","messages":[{"role":"user","content":"My name is Alex."}]}'

# Turn 2: reuse the same ID and include the conversation history.
# Replace the assistant text below with the actual response from turn 1.
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Conversation-Id: user-42-session-7" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-flash","messages":[
    {"role":"user","content":"My name is Alex."},
    {"role":"assistant","content":"Nice to meet you, Alex."},
    {"role":"user","content":"What is my name?"}
  ]}'
```

> **Note**: multi-turn sessions depend on DeepSeek upstream accepting `parent_message_id`; if the upstream has a length limit on history, long sessions may be truncated mid-way. When the original account is busy or unavailable, the proxy safely starts a new session instead of continuing the old one with another account.

---

## Model routing

The checked-in configuration exposes `deepseek-flash` as the single default local route:

```ini
MODEL_NAME=deepseek-flash
MODEL_ROUTES={"deepseek-flash":"default"}
```

`MODEL_ROUTES` values are private web-chat mode hints, not official API model IDs. The router still supports a custom `expert` hint for compatibility, but it is not the official `deepseek-v4-pro` model and may no longer select a separate upstream mode. For example, a custom alias can be configured as:

```ini
MODEL_ROUTES={"deepseek-flash":"default","my-legacy-expert":{"model_type":"expert","thinking":"enabled","search":"disabled"}}
```

A matched route takes precedence over `MODE`; per-route thinking/search overrides take precedence over their environment settings. Unmatched IDs use `MODE`, `THINKING`, and `SEARCH` fallbacks. `GET /v1/models` returns configured route IDs, or the `MODEL_NAME` fallback if no routes are configured. Responses echo the client-supplied ID; the echo does not identify the upstream model or prove that the requested ID has a corresponding route.

---

## Client rate limiting (v2.2.0)

v2.2.0 ships a sliding-window dual-dimension rate limiter:

| Env var | Default | Description |
|----------|--------|------|
| `ENABLE_RATE_LIMIT` | `true` | Master switch; set `false` to fully disable |
| `CLIENT_RPM_PER_KEY` | `60` | requests per minute per API key (0 = unlimited) |
| `CLIENT_RPM_PER_IP` | `120` | requests per minute per IP (0 = unlimited) |

Each request must **simultaneously** pass both the key and IP dimension checks. On rate limit, returns `429 Too Many Requests` with headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 47
Retry-After: 47
```

> Rate-limit state is kept in-process; multi-worker deployments (gunicorn -w N) effectively enforce N × configured values.

---

## Usage statistics

OpenAI usage fields and dashboard token totals are local estimates, using `tiktoken`'s `cl100k_base` encoding when available and a fallback heuristic otherwise. They are not official upstream billing counts. The Anthropic endpoint currently returns `-1` for input/output token counts because the private web protocol does not provide compatible values.

The server panel's `/admin/api/stats` also returns:

| Field | Description |
|------|------|
| `success_rate` | 0.0..1.0 |
| `p50_latency_ms` / `p95_latency_ms` / `p99_latency_ms` | latency percentiles of the last 1024 requests |
| `latency_window_size` | currently used ring-buffer size |
| `total_prompt_tokens` / `total_completion_tokens` | cumulative tokens over the entire process lifetime |

---

## Security recommendations (production checklist)

Before deploying to the public internet, check in order:

1. **Change the default admin password**: set `DEEPSEEK_ADMIN_PASSWORD` in `.env` to a strong, unique value. The service **refuses to start** with a weak/default password on a public bind unless `ALLOW_INSECURE_PUBLIC_DEFAULTS=true` is explicitly enabled (not recommended).
2. **Set a Fernet encryption key**: `DEEPSEEK_ENCRYPTION_KEY=***` (generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`). Existing plaintext `data/accounts.json` is auto-migrated on first startup; the original is kept as `accounts.json.v1.bak`.
3. **Set API keys**: log into the WebUI, create a client key on the Settings page, and save its one-time value in your client. Only the key hash is stored in `data/api_keys.sqlite3`; keep `ALLOW_UNAUTHENTICATED_API` as `false`.
4. **Configure CORS only if needed**: leave `ALLOWED_ORIGINS` empty for the default same-origin policy, or list only trusted origins such as `https://app.example.com`.
5. **If using a reverse proxy** (nginx, Caddy, Traefik): set `TRUSTED_PROXIES=10.0.0.0/8` (your proxy's CIDR) so admin rate limiting correctly identifies client IPs.
6. **Bind address**: default `127.0.0.1`. If using a reverse proxy, keep loopback; if exposing directly to the internet, set `HOST=0.0.0.0` and ensure TLS + WAF in front.
7. **Use HTTPS**: admin endpoints and client API keys need transport protection. Use a trusted reverse proxy such as Caddy or nginx when exposing the service.
8. **Protect credentials**: tokens/cookies can expire or be revoked without a fixed schedule. Restrict access to `data/accounts.json` and rotate credentials immediately if exposed.
9. **Rate limiting**: keep the defaults `CLIENT_RPM_PER_KEY=60`, `CLIENT_RPM_PER_IP=120` and adjust as needed.
10. **Monitoring**: `GET /health` suits liveness probes; `/admin/api/stats` suits business-metric scraping.
---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          Admin Panel                            │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │ Frontend SPA (webui) │  │ Admin API (admin.py)             │ │
│  │ · Overview           │◄─┤ · Password auth / stats / acct mgmt │
│  │ · Account pool mgmt  │  │ · Credential check               │ │
│  └──────────────────────┘  └───────┬──────────────────────────┘ │
└────────────────────────────────────┼────────────────────────────┘
                                     │
┌──────────────┐     OpenAI format    ┌────────▼─────────────────┐
│  Client apps  │ ◄───── SSE ────────► │   FastAPI Server          │
│ (NextChat,    │                      │   (server.py)             │
│  OpenWebUI,   │                      │                           │
│  custom)      │                      │  ┌─────────────────────┐  │
└──────────────┘                      │  │  AccountPool         │  │
                                      │  │  (account_pool.py)   │  │
                                      │  │  · multi-acct round-  │  │
                                      │  │    robin select      │  │
                                      │  │  · state tracking    │  │
                                      │  │  · health checks     │  │
                                      │  └────────┬────────────┘  │
                                      │           │                │
                                      │  ┌────────▼────────────┐  │
                                      │  │  ChatAdapter         │  │
                                      │  │  (adapter.py)        │  │
                                      │  │  - PoW solving       │  │
                                      │  │  - Session mgmt      │  │
                                      │  │  - SSE parsing       │  │
                                      │  │  - Fragment stm      │  │
                                      │  └────────┬────────────┘  │
                                      │           │                │
                                      │  ┌────────▼────────────┐  │
                                      │  │ StreamSieve          │  │
                                      │  │ (tool_sieve.py)      │  │
                                      │  │ - DSML detection     │  │
                                      │  │ - Real-time sep      │  │
                                      │  └──────────────────────┘  │
                                      │                           │
                                      │  ┌──────────────────────┐  │
                                      │  │ DSML Parser          │  │
                                      │  │ (tool_dsml.py)       │  │
                                      │  │ - XML parsing        │  │
                                      │  │ - Format conv        │  │
                                      │  └──────────────────────┘  │
                                      └──────────┬────────────────┘
                                                 │
                                      DeepSeek native protocol
                                      (PoW + SSE)
                                                 │
                                      ┌──────────▼────────────┐
                                      │  chat.deepseek.com    │
                                      │  (DeepSeek Chat API)  │
                                      └───────────────────────┘
```

### Core components

| File | Responsibility |
|------|------|
| `server.py` | FastAPI server, routing, MODE/THINKING control, OpenAI SSE formatting |
| `adapter.py` | DeepSeek protocol adapter — PoW challenge solving, session create/manage, native SSE parsing, fragment state machine |
| `anthropic_format.py` | Anthropic `/v1/messages` format conversion — request parsing, response assembly, SSE generation |
| `tool_sieve.py` | StreamSieve streaming sieve engine — character-by-character DSML tool-call tag detection, real-time separation of body text and tool calls |
| `tool_dsml.py` | DSML parser/generator — bidirectional XML-format DSML ↔ OpenAI tool_calls conversion |
| `account_pool.py` | Multi-account management — CRUD, state tracking (idle/busy/error), round-robin allocation, health checks |
| `admin.py` | Admin backend API — password auth, request stats, account pool CRUD, credential recheck trigger |
| `webui-new/` | React/TypeScript admin dashboard and playground; build output is in `webui-new/dist/` |
| `sha3_wasm_bg.wasm` | WASM binary for DeepSeekHashV1 proof-of-work solving |

### Request lifecycle

1. **Client request** → `/v1/chat/completions` receives an OpenAI-format request.
2. **Mode parsing** → `server.py` determines `model_type` and `thinking_enabled` based on env vars and request params.
3. **DSML injection** → if there are `tools`, `build_dsml_tool_prompt()` generates a DSML-format system prompt.
4. **PoW solving** → `adapter.py` requests and solves the DeepSeekHashV1 challenge.
5. **Session creation** → creates a new DeepSeek Chat session (optionally reused).
6. **Request sending** → sends to `/api/v0/chat/completion` in native format.
7. **Response handling**:
   - Non-streaming: parse SSE to collect all content → detect tool calls → return OpenAI format.
   - Streaming: forward token by token → StreamSieve filters in real time → format OpenAI SSE.

---

## File Structure

```
├── server.py            # FastAPI endpoints, auth, routing, and response formatting
├── adapter.py           # Private DeepSeek web protocol, proof of work, sessions, and SSE
├── model_router.py      # Local model-alias routing to default / expert web modes
├── anthropic_format.py  # Anthropic Messages request/response conversion
├── tool_sieve.py        # Streaming DSML tool-call detection
├── tool_dsml.py         # DSML prompt generation and parsing
├── account_pool.py      # Multi-account pool management and health checks
├── session_cache.py     # Caller-scoped, account-bound upstream session cache
├── admin.py             # Admin API, account management, and runtime statistics
├── api_key_store.py     # Hashed client API-key storage
├── crypto.py            # Optional account-credential encryption
├── webui-new/           # React/TypeScript admin dashboard and playground
├── tests/               # Offline unit, smoke, and integration checks
├── scripts/run_e2e.py   # Offline end-to-end validation
├── sha3_wasm_bg.wasm    # Proof-of-work solver module
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variable template
├── start.bat            # Windows startup script
└── docs/release-notes/  # Release history
```

Production WebUI assets are built into `webui-new/dist/` and served by the FastAPI app at `/webui/`.

---

## FAQ

### Q: Requests return 502 Bad Gateway after startup

Usually invalid credentials or a network issue:

1. Check the account status in WebUI > Account Pool; for non-interactive deployments, verify the credentials in `data/accounts.json` are still valid.
2. Check that `chat.deepseek.com` is reachable (may need a proxy).
3. Check the specific error in the console logs.

### Q: Streaming output only has `reasoning_content`, no `content`

When thinking is enabled, the upstream may emit reasoning fragments before the answer. The stream is not complete until the finish event and `[DONE]` marker arrive. If the stream ends without answer content:

1. Check whether the client stopped reading before the stream finished.
2. Confirm the server version and inspect the final `finish_reason` and server logs for upstream errors.

### Q: How do I disable reasoning output?

Set `THINKING=disabled` to override request-level thinking. If a `MODEL_ROUTES` entry explicitly sets a thinking value, that per-model override takes precedence; remove or change it if you want thinking disabled for that route.

### Q: Constantly loading / very slow responses

- Expert-mode or thinking-enabled requests may take longer; wait for the stream to finish before treating it as stalled.
- PoW solving can take seconds on low-performance machines.
- Check network latency to `chat.deepseek.com`.

### Q: curl on Windows returns 422 for non-ASCII request text

Some Windows shells use a legacy console encoding that can mis-encode non-ASCII JSON text. Solutions:

```bash
# Option 1: write the request body to a JSON file
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @body.json

# Option 2: use PowerShell (recommended)
Invoke-RestMethod -Uri http://localhost:8080/v1/chat/completions `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"model":"deepseek-flash","messages":[{"role":"user","content":"Hello"}],"stream":true}'
```

### Q: Changes to `.env` don't take effect

Restart the server process after editing `.env`; Uvicorn's source-file reload watcher does not automatically restart when only the environment file changes:

```bash
# Stop the existing server with Ctrl+C in its terminal, then restart it.
python -m uvicorn server:app --host 127.0.0.1 --port 8080
```

### Q: Browser extensions (e.g. YouTube subtitle translation) fail, logs show 405 Method Not Allowed

Some Chrome extensions send an `OPTIONS` preflight request (CORS preflight) before using the OpenAI-compatible API to check whether the server allows cross-origin access. If the server does not handle `OPTIONS`, it returns `405 Method Not Allowed`, breaking the extension.

**Solution:** CORS is same-origin by default. If a trusted browser client needs cross-origin access, set `ALLOWED_ORIGINS` to a narrow comma-separated allow-list and restart the service. Do not use a wildcard origin for a public deployment.

### Q: Does it support multi-turn conversations?

Yes. Provide a stable conversation identifier: `X-Conversation-Id` or OpenAI's `user` field, or Anthropic's `metadata.user_id`. Without one, each request starts a fresh upstream session. Reuse is caller-scoped, account-bound, and expires according to `SESSION_CACHE_TTL`.

### Q: How do I view PoW and adapter debug information?

Set `LOG_LEVEL=DEBUG` in `.env` and restart the service. Avoid sharing logs without checking for account identifiers or other sensitive information.

### Q: How long do account credentials last?

DeepSeek can expire or revoke web-account tokens and cookies without a fixed schedule. If requests return `401` or `403`, refresh the credentials in the WebUI Account Pool or `data/accounts.json`; account credentials are not read from `.env`.

---

## Environment Variable Reference

### Core config

| Variable | Default | Required | Description |
|------|--------|------|------|
| `HOST` | `127.0.0.1` | no | Listen address. `0.0.0.0` refuses to start with default admin password |
| `PORT` | `8080` | no | Server listen port |
| `ALLOW_UNAUTHENTICATED_API` | `false` | no | whether to allow unauthenticated `/v1/*` access; do NOT enable for public |
| `ALLOW_INSECURE_PUBLIC_DEFAULTS` | `false` | no | explicitly confirm using default password on public internet (not recommended) |

Client API keys are managed in WebUI > Settings, and only hashes are stored in SQLite. Legacy `.env` values from `API_KEYS` / `DEEPSEEK_API_KEY` are imported once when the key database is first created; remove the old entries from `.env` after confirming clients still work.

### Account pool storage

| Variable | Default | Required | Description |
|------|--------|------|------|
| `ACCOUNT_STORE_PATH` | `data/accounts.json` | no | panel-persisted account save path |

### Model behavior

| Variable | Default | Description |
|------|--------|------|
| `MODEL_NAME` | `deepseek-flash` | Fallback client-facing ID for requests that omit `model`; used by `/v1/models` when no routes are configured. |
| `MODE` | `auto` | Proxy-side fallback: `auto` / `quick` send `default`; `expert` sends a legacy hint whose current upstream effect is unverified. A matching route wins first. |
| `THINKING` | `auto` | `auto` / `enabled` / `disabled`; matching route settings take precedence. |
| `SEARCH` | `auto` | `auto` / `enabled` / `disabled`; matching route settings take precedence. |
| `MODEL_ROUTES` | `{"deepseek-flash":"default"}` | Local alias-to-hint map; optional legacy `expert` values are private-protocol hints, not official model IDs. |

### Admin panel

| Variable | Default | Description |
|------|--------|------|
| `DEEPSEEK_ADMIN_PASSWORD` | `"admin"` | admin panel login password (must change for public deployment) |

### Rate limiting & sessions

| Variable | Default | Description |
|------|--------|------|
| `ENABLE_RATE_LIMIT` | `true` | client rate-limit master switch |
| `CLIENT_RPM_PER_KEY` | `60` | requests per minute per API key |
| `CLIENT_RPM_PER_IP` | `120` | requests per minute per IP |
| `SESSION_CACHE_TTL` | `1800` | Caller-scoped session-cache lifetime in seconds; `0` disables reuse. |

### Security & encryption

| Variable | Default | Description |
|------|--------|------|
| `ALLOWED_ORIGINS` | `""` | CORS allowed origin list (comma-separated), empty = same-origin |
| `ALLOW_CORS_CREDENTIALS` | `false` | whether to allow credentialed cross-origin (needs `ALLOWED_ORIGINS`) |
| `TRUSTED_PROXIES` | `""` | trusted proxy IP/CIDR (when set, `X-Forwarded-For` is honored) |
| `DEEPSEEK_ENCRYPTION_KEY` | `""` | Fernet key; when set, token/cookies in `data/accounts.json` are auto-encrypted |

### Logging & anti-detection

| Variable | Default | Description |
|------|--------|------|
| `LOG_LEVEL` | `INFO` | DEBUG/INFO/WARNING/ERROR |
| `LOG_FORMAT` | `json` | `json` (production) or `text` (development) |
| `DEEPSEEK_IMPERSONATE` | `chrome131` | curl_cffi TLS fingerprint profile |
| `DEEPSEEK_JITTER_SECS` | `0.4` | Random delay before upstream calls, in seconds. |
| `DEEPSEEK_MAX_CONCURRENCY` | `2` | Maximum simultaneous upstream requests across all accounts. |
| `DEEPSEEK_RATE_LIMIT_RETRY_DELAYS` | `5,15` | Backoff delays in seconds before retrying rate-limited requests. |
| `DSML_MAX_BUFFER_BYTES` | `1048576` | StreamSieve capture buffer cap. |
| `DISABLE_AUTO_RECOVER` | `false` | Set `true` to disable account auto-recovery. |

---

## Dependencies

| Package | Minimum version | Purpose |
|----|----------|----|
| `fastapi` | ≥0.115.0 | Web framework |
| `uvicorn` | ≥0.30.0 | ASGI server |
| `curl_cffi` | ≥0.7.1 | Upstream HTTP requests with browser/TLS impersonation |
| `wasmtime` | ≥15.0.0 | WASM runtime for proof-of-work solving |
| `python-dotenv` | ≥1.0.0 | `.env` file loading |
| `httpx2` | ≥2.0.0 | In-process FastAPI test client transport |
| `httpx` | ≥0.27.0 | HTTP dependency used by the transport stack |
| `cryptography` | ≥42.0.0 | Optional account-credential encryption |
| `tiktoken` | ≥0.7.0 | Local OpenAI token-count estimates |
| `pytest` | ≥8.0.0 | Test suite |

---

## Tests and WebUI build

The local test suite does not require DeepSeek credentials or live upstream access:

```bash
python -m pip install -r requirements.txt
python -m pytest
python -m tests.smoke
python scripts/run_e2e.py

cd webui-new
npm ci
npm run build
```

A passing offline test/build validates local behavior only; it does not prove the private DeepSeek web protocol is currently accepted.

---

## License

This project is released into the **public domain** under the **Unlicense**.

```
This is free and unencumbered software released into the public domain.
```

You are free to copy, modify, publish, use, compile, sell, or distribute this software, in either source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.

**This software is provided without any warranty**, without guarantee of service availability, accuracy, or stability. Any consequences arising from the use of this project are the sole responsibility of the user.

---

## Acknowledgments

- [DeepSeek](https://deepseek.com) — fine AI models and platform
- OpenAI — API standard format reference
- [wasmtime-py](https://github.com/bytecodealliance/wasmtime-py) — WASM runtime
- [@minhmc2007](https://github.com/minhmc2007) — contributed the multi-turn session reuse fix (PR #10, v3.3.0)
- [@Zhangkc](https://github.com/Zhangkc) — contributed the request-trend chart fix: stats sampler read a nonexistent avg_latency_ms attribute (PR #14, v3.3.2)
