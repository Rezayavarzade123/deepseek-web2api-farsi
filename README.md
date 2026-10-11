# DeepSeek Web Chat API Proxy

> An unofficial proxy that adapts the private `chat.deepseek.com` web-chat protocol to OpenAI-compatible and Anthropic-compatible endpoints.

**Important:** This project talks to DeepSeek's web application, not the official `api.deepseek.com` API. It uses a signed-in web account's token and cookies and solves the web client's proof-of-work challenge. The private protocol can change without notice. This project is not affiliated with DeepSeek; use it at your own risk and in compliance with DeepSeek's terms.

For expanded installation guidance, API details, FAQs, and the full configuration reference, see the [full English guide](README_en.md).

## DeepSeek model compatibility

As of **October 11, 2026**, DeepSeek's official API uses `deepseek-flash` for DeepSeek-V4.1-Flash. The `deepseek-v4-pro` API ID is currently routed to V4.1-Flash at V4.1-Flash rates until V4.1-Pro launches, according to the [September model update](https://api-docs.deepseek.com/news/news260910/) and [V4-Pro release notice](https://api-docs.deepseek.com/news/news260813/). The legacy API IDs `deepseek-chat` and `deepseek-reasoner` were scheduled for retirement on July 24, 2026; see the [official change log](https://api-docs.deepseek.com/updates/).

This proxy now exposes `deepseek-flash` and `deepseek-v4-pro` as **local routing aliases** by default:

| Client model ID | Local route | Meaning inside this proxy |
|---|---|---|
| `deepseek-flash` | `default` | DeepSeek web-chat default/quick mode |
| `deepseek-v4-pro` | `expert` | DeepSeek web-chat expert mode |

These IDs are not sent to `api.deepseek.com`, and the proxy does not guarantee which underlying model DeepSeek assigns to a web-chat mode. For official API features or multimodal input, use DeepSeek's official API directly and check its current model-routing documentation. This proxy currently supports **text only**.

The upstream web protocol cannot be live-validated from this repository's test environment because it requires a real account and network access to DeepSeek. The offline test suite checks request mapping and compatibility behavior without contacting DeepSeek.

## Features

- OpenAI-compatible `POST /v1/chat/completions` and `GET /v1/models`, including streaming.
- Anthropic-compatible `POST /v1/messages`, including streaming and tool-use blocks.
- Client API-key authentication (`Authorization: Bearer` or `x-api-key`).
- Default and expert routing, reasoning output, and optional web search flags.
- DSML prompt-based tool calling with streaming detection. Tool calling is best-effort, not native or guaranteed.
- Automatic proof-of-work challenge solving, session management, and optional caller-scoped multi-turn session reuse.
- Multi-account pool with round-robin selection, health checks, and recovery.
- Per-API-key and per-IP rate limiting, usage estimates, and an admin dashboard.
- Optional Fernet encryption for stored account credentials.

## Requirements

- Python 3.10 or newer.
- Network access to `chat.deepseek.com` and the DeepSeek signature endpoints used by the adapter.
- A valid DeepSeek web-chat account with a current token and cookies.
- Node.js 20+ and npm to build the WebUI when its build output is missing. `start.bat` auto-builds when Node/npm is installed. API-only use can run without Node.js.

## Quick start

### 1. Install

```bash
git clone https://github.com/Rezayavarzade123/deepseek-web2api-free-test.git
cd deepseek-web2api-free-test
python -m venv .venv
```

Activate the virtual environment and install the Python requirements:

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

On Windows, you can instead run `start.bat`; it locates or creates a virtual environment, installs missing dependencies, builds the WebUI when needed, and starts the server.

### 2. Configure the server

```bash
cp .env.example .env
```

Set a strong, unique `DEEPSEEK_ADMIN_PASSWORD` before exposing the admin panel. The server refuses a public bind with a weak/default password unless the unsafe override is explicitly enabled. Keep `HOST=127.0.0.1` for local use or behind a reverse proxy.

The default model routes are:

```ini
MODEL_NAME=deepseek-flash
MODEL_ROUTES={"deepseek-flash":"default","deepseek-v4-pro":"expert"}
```

`MODEL_NAME` is the fallback model ID when a client omits `model`. `MODEL_ROUTES` maps client-provided IDs to web-chat modes; it does not forward an official API model ID. You may add your own aliases or mode settings.

If running API-only without a built WebUI, the legacy `API_KEYS` or `DEEPSEEK_API_KEY` settings can seed client authentication when the SQLite key store is first created. The values are imported once; remove them from `.env` afterward. The recommended ongoing workflow is to manage keys in WebUI > Settings.

### 3. Add a DeepSeek web account

1. Sign in at [chat.deepseek.com](https://chat.deepseek.com).
2. Open browser Developer Tools, select **Network**, and send a message.
3. Inspect a chat completion request and copy its bearer token and complete cookie header.
4. Add the credentials in **WebUI → Account Pool**, or write them to `data/accounts.json`.

Account tokens and cookies are secrets. Do not commit them or put them in a publicly readable file. Account credentials are not loaded from `.env`.

### 4. Start the service and create a client key

```bash
# macOS / Linux / Windows (inside the virtual environment)
python -m uvicorn server:app --host 127.0.0.1 --port 8080
```

Open `http://127.0.0.1:8080/webui/`, sign in with `DEEPSEEK_ADMIN_PASSWORD`, and create a client API key on the **Settings** page. The full key is displayed once; only its hash is stored by the server.

Check the server and available aliases:

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/v1/models \
  -H "Authorization: Bearer YOUR_CLIENT_API_KEY"
```

### 5. Make a request

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-flash","messages":[{"role":"user","content":"Hello!"}],"stream":false}'
```

The response echoes the requested `model` ID. That ID is a proxy alias and does not prove which underlying model the web application used.

## API reference

### `POST /v1/chat/completions`

The endpoint accepts the OpenAI Chat Completions request format with these supported fields:

| Field | Type | Notes |
|---|---|---|
| `model` | string | Client-facing route alias. Defaults to `MODEL_NAME`; see `MODEL_ROUTES`. |
| `messages` | array | Required. Supports system, user, assistant, and tool messages. Text content only. |
| `stream` | boolean | Enables OpenAI-style server-sent events. |
| `thinking_mode` | boolean | Requests a reasoning/thinking response where supported by the web client. |
| `search_enabled` | boolean | Requests web search where supported by the web client. |
| `tools` | array | OpenAI function definitions, converted to a DSML prompt. Best-effort only. |
| `tool_choice` | string or object | Used as a prompt hint; forced tool selection is not guaranteed. |
| `user` | string | Optional stable caller identifier for multi-turn session reuse. |
| `temperature`, `top_p`, `max_tokens` | number | Accepted for client compatibility but not forwarded by the web adapter. |

When streaming, the proxy returns OpenAI-format chunks and ends with `data: [DONE]`. Reasoning, when available, is emitted in `reasoning_content` before answer text. Usage values are local estimates, not authoritative upstream billing counts.

Example request:

```json
{
  "model": "deepseek-v4-pro",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain how TLS works."}
  ],
  "stream": true,
  "thinking_mode": true
}
```

### `POST /v1/messages`

Anthropic Messages-compatible adapter. It accepts Anthropic-style `messages`, `system`, `tools`, `stream`, and `thinking` fields. `max_tokens`, `temperature`, `top_p`, stop sequences, and metadata other than the supported user ID are not sent upstream. The response echoes the client-provided `model` value.

### `GET /v1/models`

Returns the model IDs declared in `MODEL_ROUTES`. If no route table is configured, it returns the `MODEL_NAME` fallback.

### Multi-turn conversations

A conversation is reused only when the caller supplies a stable identifier: `X-Conversation-Id`, OpenAI's top-level `user`, or Anthropic `metadata.user_id`. Cache keys are scoped to the caller, and a cached upstream session remains bound to the account that created it. Without an explicit identifier, each request starts a new upstream session. Set `SESSION_CACHE_TTL=0` to disable reuse.

## Configuration reference

See `.env.example` for the complete commented template. Frequently used settings:

| Variable | Default | Purpose |
|---|---:|---|
| `HOST` | `127.0.0.1` | Listen address. Prefer loopback behind a reverse proxy. |
| `PORT` | `8080` | Listen port. |
| `DEEPSEEK_ADMIN_PASSWORD` | `admin` | Admin WebUI password. Change before deployment. |
| `ALLOW_UNAUTHENTICATED_API` | `false` | Disables client-key checks when enabled; local development only. |
| `MODEL_NAME` | `deepseek-flash` | Fallback model ID returned when a request omits `model`. |
| `MODEL_ROUTES` | current aliases | JSON mapping of public aliases to `default` / `expert` and optional thinking/search overrides. |
| `MODE` | `auto` | `auto`, `quick`, or `expert`; fallback route for unmatched model IDs. |
| `THINKING` | `auto` | `auto`, `enabled`, or `disabled`. |
| `SEARCH` | `auto` | `auto`, `enabled`, or `disabled`. |
| `ACCOUNT_STORE_PATH` | `data/accounts.json` | Account pool storage file. |
| `DEEPSEEK_ENCRYPTION_KEY` | unset | Fernet key for encrypting account credentials at rest. |
| `SESSION_CACHE_TTL` | `1800` | Caller-scoped session cache lifetime in seconds; `0` disables reuse. |
| `DEEPSEEK_MAX_CONCURRENCY` | `2` | Maximum simultaneous upstream requests across all accounts. |
| `CLIENT_RPM_PER_KEY` | `60` | Client requests per minute per API key; `0` disables this dimension. |
| `CLIENT_RPM_PER_IP` | `120` | Client requests per minute per IP; `0` disables this dimension. |
| `ALLOWED_ORIGINS` | empty | Comma-separated CORS allow-list; empty means same-origin only. |
| `TRUSTED_PROXIES` | empty | Trusted proxy IPs/CIDRs for forwarded client IP handling. |
| `DEEPSEEK_IMPERSONATE` | `chrome131` | curl_cffi browser/TLS impersonation profile. |
| `DEEPSEEK_JITTER_SECS` | `0.4` | Random delay before upstream calls to reduce burstiness. |

`MODE`, `THINKING`, and `SEARCH` are overridden first by matching per-model route settings. If the route leaves a setting unspecified, the corresponding environment variable takes precedence over the request field.

## Security and deployment

- Keep the admin password strong and do not enable `ALLOW_INSECURE_PUBLIC_DEFAULTS` on a public service.
- Use HTTPS and a reverse proxy if exposing the service beyond localhost.
- Keep `ALLOW_UNAUTHENTICATED_API=false`, create client keys in the admin UI, and rotate/revoke keys as needed.
- Set `DEEPSEEK_ENCRYPTION_KEY` to encrypt account tokens/cookies at rest. Back up the key separately; losing it makes encrypted credentials unreadable.
- Restrict permissions on `data/accounts.json`, `data/api_keys.sqlite3`, and the `data/` directory.
- Leave `ALLOWED_ORIGINS` empty unless browser-based cross-origin access is needed; then allow only trusted origins.
- Treat web-account cookies and tokens like passwords. Revoke or refresh them if exposed.

## Development and tests

The test suite does not require DeepSeek credentials or upstream network access:

```bash
python -m pip install -r requirements.txt
python -m pytest
python -m tests.smoke
python scripts/run_e2e.py
```

Build the React WebUI with Node.js:

```bash
cd webui-new
npm ci
npm run build
```

Main components:

- `server.py` — FastAPI endpoints, authentication, model routing, request/response adaptation.
- `adapter.py` — private DeepSeek web protocol, proof-of-work, session handling, and SSE parsing.
- `model_router.py` — client model alias to web-chat mode mapping.
- `anthropic_format.py` — Anthropic Messages request/response conversion.
- `tool_dsml.py` and `tool_sieve.py` — prompt-based tool calls and streaming detection.
- `account_pool.py`, `session_cache.py`, and `admin.py` — account/session management and admin APIs.
- `webui-new/` — React/TypeScript admin dashboard and playground.

## Known limitations

- This relies on an undocumented private web protocol and may stop working after a DeepSeek frontend or anti-abuse change.
- The sandbox test suite cannot authenticate to DeepSeek or verify a live upstream request; a successful local build is not a live-service guarantee.
- Only text input is supported, including when the official model behind a web-chat mode supports other modalities.
- Tool calling is simulated through DSML instructions. Parallel calls, strict JSON schemas, and `tool_choice` guarantees are not supported.
- `temperature`, `top_p`, and `max_tokens` are not forwarded to the web client.
- OpenAI usage values are local estimates; Anthropic usage is currently reported as `-1` because the private web protocol does not provide compatible counts.
- Tokens/cookies expire and may be invalidated or rate-limited by DeepSeek. Recheck account credentials or replace expired tokens/cookies when needed.
- Official API model IDs are only proxy aliases here. For precise model selection and official API support, use DeepSeek's official API directly.

## License

This project is released into the public domain under the **Unlicense**. It is provided without warranty.
