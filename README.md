# DeepSeek Web Chat API Proxy

[English](README_en.md) · [فارسی](README_fa.md)

> An unofficial proxy that adapts the private `chat.deepseek.com` web-chat protocol to OpenAI-compatible and Anthropic-compatible endpoints.

**Important:** This project talks to DeepSeek's web application, not the official `api.deepseek.com` API. It uses a signed-in web account's token and cookies and solves the web client's proof-of-work challenge. The private protocol can change without notice. This project is not affiliated with DeepSeek; use it at your own risk and in compliance with DeepSeek's terms.

For expanded installation guidance, API details, FAQs, and the full configuration reference, see the [full English guide](README_en.md).

## DeepSeek model compatibility

As of **October 11, 2026**, DeepSeek's official API lists `deepseek-flash` as V4.1-Flash with native vision support, and `deepseek-v4-pro` as V4-Pro-0813, which is text-only. The current [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/) page lists both; the [updated change log](https://api-docs.deepseek.com/updates/) says Pro API service continues after September 14, 2026, with billing unchanged. The legacy API IDs `deepseek-chat` and `deepseek-reasoner` were announced for retirement on July 24, 2026.

DeepSeek V4.1-Flash combines visual understanding with strong reasoning capabilities. The web app's quick, expert, and vision experience has been reported as unified into an adaptive mode ([AIbase report](https://www.aibase.com/news/30949)); that product behavior is not a verified contract for this private web protocol.

The proxy exposes one default **local route alias**:

| Client model ID | Local route | Meaning inside this proxy |
|---|---|---|
| `deepseek-flash` | `default` | Default private web-chat route hint for the unified Flash experience |

`deepseek-flash` is not sent to `api.deepseek.com`, and the proxy cannot guarantee which upstream model or mode the web app selects. Although V4.1-Flash supports vision, this proxy currently forwards text only; image upload/content conversion is not implemented. OpenAI non-text parts and Anthropic image blocks are rejected with HTTP 400 rather than silently dropped. Use DeepSeek's official API directly for image input or official API features.

The private web protocol cannot be live-validated in this environment because it requires a real account and access to DeepSeek. Offline tests verify local routing and compatibility behavior only.

## Features

- OpenAI-compatible `POST /v1/chat/completions` and `GET /v1/models`, including streaming.
- Anthropic-compatible `POST /v1/messages`, including streaming and tool-use blocks.
- Client API-key authentication (`Authorization: Bearer` or `x-api-key`).
- A default local web-chat route plus configurable legacy expert/thinking/search hints; their effect on the current private protocol is unverified.
- DSML prompt-based tool calling with streaming detection. Tool calling is best-effort, not native or guaranteed.
- Automatic proof-of-work solving and caller-scoped multi-turn chat reuse; clients can provide explicit IDs to isolate conversations.
- Multi-account pool with round-robin selection, health checks, and recovery.
- Per-API-key and per-IP rate limiting, usage estimates, and an admin dashboard.
- Optional Fernet encryption for stored account credentials.
- English and Persian (Farsi) WebUI language selector; Persian uses a right-to-left layout.
- Optional one-shot Chromium helper to copy your own DeepSeek chat token and Cookie header locally; see [the helper guide](tools/chromium-credential-capture/README.md).
- Per-user installer that adds the `ds2api` command to PATH without administrator rights.

## Requirements

- Python 3.10 or newer.
- Network access to `chat.deepseek.com` and the DeepSeek signature endpoints used by the adapter.
- A valid DeepSeek web-chat account with a current token and cookies.
- Node.js 20+ and npm to build the WebUI when its build output is missing. `start.bat` auto-builds when Node/npm is installed. API-only use can run without Node.js.

## Quick start

### 1. Install

Recommended per-user installer (no administrator rights required).

#### Windows PowerShell

```powershell
git clone https://github.com/Rezayavarzade123/deepseek-web2api-free-test.git
Set-Location .\deepseek-web2api-free-test
py -3 .\scripts\install.py
$env:Path = "$env:LOCALAPPDATA\Programs\DS2API\bin;$env:Path"
ds2api
```

#### Windows Command Prompt

```bat
git clone https://github.com/Rezayavarzade123/deepseek-web2api-free-test.git
cd /d deepseek-web2api-free-test
py -3 scripts\install.py
set "PATH=%LOCALAPPDATA%\Programs\DS2API\bin;%PATH%"
ds2api
```

#### macOS / Linux

```bash
git clone https://github.com/Rezayavarzade123/deepseek-web2api-free-test.git
cd deepseek-web2api-free-test
python3 scripts/install.py
export PATH="$HOME/.local/bin:$PATH"
ds2api
```

The installer creates a virtual environment, installs Python dependencies, builds the WebUI when Node.js 20+ is available, and adds the `ds2api` command to your user PATH. The commands above update the current shell's PATH so `ds2api` can run immediately; future terminals also find it through the installed user PATH. On Windows, `ds2api.cmd` works by name in both Command Prompt and PowerShell. A new local installation uses `admin` as the WebUI password for convenience. Change it before exposing DS2API to any network; the server refuses a public bind with this weak default. The installer preserves `.env` and `data/` when rerun to update.

If Node.js is not installed, setup completes in API-only mode. Install Node.js 20+ and rerun the installer to build the WebUI. You can also pass `--skip-webui` to intentionally install API-only.

#### Open the WebUI

When `ds2api` starts, it prints the WebUI URL and current admin password in the terminal. Keep that output private. Open [http://127.0.0.1:8080/webui/](http://127.0.0.1:8080/webui/) in your browser and sign in with the printed password (`admin` by default). The command does not open a browser automatically. If you changed `PORT` in `.env`, use that port instead of `8080`.

If you need to retrieve a changed password from the installed `.env`:

Windows Command Prompt:

```bat
findstr /B "DEEPSEEK_ADMIN_PASSWORD=" "%LOCALAPPDATA%\Programs\DS2API\.env"
```

Windows PowerShell:

```powershell
Select-String '^DEEPSEEK_ADMIN_PASSWORD=' "$env:LOCALAPPDATA\Programs\DS2API\.env"
```

macOS / Linux:

```bash
grep '^DEEPSEEK_ADMIN_PASSWORD=' "${XDG_DATA_HOME:-$HOME/.local/share}/ds2api/.env"
```

If you installed to a custom `--install-dir`, substitute that location in the command for your operating system.

For a manual development setup instead, create a virtual environment and install requirements:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

On Windows, `start.bat` remains available for launching from a source checkout.

### 2. Configure the server

The per-user installer creates `.env` with the local-test password `admin`. Change it to a strong, unique password before exposing the admin panel to any network. Do not overwrite the rest of that file. For a manual source-checkout setup only, create it with:

```bash
cp .env.example .env
```

Set a strong, unique `DEEPSEEK_ADMIN_PASSWORD` before exposing the admin panel. The server refuses a public bind with a weak/default password unless the unsafe override is explicitly enabled. Keep `HOST=127.0.0.1` for local use or behind a reverse proxy.

The default model routes are:

```ini
MODEL_NAME=deepseek-flash
MODEL_ROUTES={"deepseek-flash":"default"}
```

`MODEL_NAME` is the fallback model ID when a client omits `model`. `MODEL_ROUTES` maps client-provided IDs to private web-chat mode hints; it does not forward an official API model ID. The router retains an optional legacy `expert` hint, but that is not the official `deepseek-v4-pro` API model and may not select a separate upstream mode.

If running API-only without a built WebUI, the legacy `API_KEYS` or `DEEPSEEK_API_KEY` settings can seed client authentication when the SQLite key store is first created. The values are imported once; remove them from `.env` afterward. The recommended ongoing workflow is to manage keys in WebUI > Settings.

### 3. Add a DeepSeek web account

1. Sign in at [chat.deepseek.com](https://chat.deepseek.com).
2. Open browser Developer Tools, select **Network**, and send a message.
3. Inspect a chat completion request and copy its bearer token and complete cookie header.
4. Add the credentials in **WebUI → Account Pool**, or write them to `data/accounts.json`.

For Chrome, Edge, or Brave, the optional [one-shot credential helper](tools/chromium-credential-capture/README.md) can capture the next matching request after you explicitly arm it. It copies values only when you press a copy button; it does not upload them.

Account tokens and cookies are secrets. Do not commit them or put them in a publicly readable file. Account credentials are not loaded from `.env`.

### 4. Start the service and create a client key

After using the installer, open a new terminal and run `ds2api`; the command is on your user PATH. For a manual source-checkout setup, start the server with:

```bash
# macOS / Linux / Windows (inside the virtual environment)
python -m uvicorn server:app --host 127.0.0.1 --port 8080
```

To uninstall, use the system Python (not the app's virtualenv): in Windows PowerShell run `py -3 "$env:LOCALAPPDATA\Programs\DS2API\scripts\uninstall.py"`; on macOS/Linux run `python3 ~/.local/share/ds2api/scripts/uninstall.py`. This removes the PATH entry and app files but preserves `.env` and `data/`; add `--purge-user-data` only if you also want those deleted. If you chose a custom `--install-dir`, substitute that path.

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
  "model": "deepseek-flash",
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

A stable identifier (`X-Conversation-Id`, OpenAI's top-level `user`, or Anthropic `metadata.user_id`) keeps separate conversations isolated. By default, requests without an identifier reuse one upstream chat per authenticated API key (`SESSION_CACHE_FALLBACK=per_caller`), which supports clients such as Claude Code that resend history without a conversation ID. Those untagged requests sharing the same key also share one chat, so use separate keys for parallel conversations or set `SESSION_CACHE_FALLBACK=none` and send explicit IDs. Cached sessions remain bound to the account that created them. Set `SESSION_CACHE_TTL=0` to disable reuse.

## Configuration reference

See `.env.example` for the complete commented template. Frequently used settings:

| Variable | Default | Purpose |
|---|---:|---|
| `HOST` | `127.0.0.1` | Listen address. Prefer loopback behind a reverse proxy. |
| `PORT` | `8080` | Listen port. |
| `DEEPSEEK_ADMIN_PASSWORD` | `admin` | Admin WebUI password. Change before deployment. |
| `ALLOW_UNAUTHENTICATED_API` | `false` | Disables client-key checks when enabled; local development only. |
| `MODEL_NAME` | `deepseek-flash` | Fallback model ID returned when a request omits `model`. |
| `MODEL_ROUTES` | `{"deepseek-flash":"default"}` | Local alias map to private web-chat hints; `expert` is a legacy configurable hint, not an official API model. |
| `MODE` | `auto` | `auto` / `quick` map to `default`; `expert` sends a legacy hint whose current upstream effect is unverified. |
| `THINKING` | `auto` | `auto`, `enabled`, or `disabled`. |
| `SEARCH` | `auto` | `auto`, `enabled`, or `disabled`. |
| `ACCOUNT_STORE_PATH` | `data/accounts.json` | Account pool storage file. |
| `DEEPSEEK_ENCRYPTION_KEY` | unset | Fernet key for encrypting account credentials at rest. |
| `SESSION_CACHE_TTL` | `1800` | Session cache lifetime in seconds; `0` disables reuse. |
| `SESSION_CACHE_FALLBACK` | `per_caller` | Reuse one chat for untagged requests per authenticated caller; set `none` to require an explicit conversation ID. |
| `DEEPSEEK_MAX_CONCURRENCY` | `2` | Maximum simultaneous upstream requests across all accounts. |
| `CLIENT_RPM_PER_KEY` | `60` | Client requests per minute per API key; `0` disables this dimension. |
| `CLIENT_RPM_PER_IP` | `120` | Client requests per minute per IP; `0` disables this dimension. |
| `ALLOWED_ORIGINS` | empty | Comma-separated CORS allow-list; empty means same-origin only. |
| `TRUSTED_PROXIES` | empty | Trusted proxy IPs/CIDRs for forwarded client IP handling. |
| `DEEPSEEK_IMPERSONATE` | `chrome131` | curl_cffi browser/TLS impersonation profile. |
| `DEEPSEEK_JITTER_SECS` | `0.4` | Random delay before upstream calls to reduce burstiness. |

`MODE`, `THINKING`, and `SEARCH` describe the fields the proxy sends: matching route settings take precedence, then explicit environment settings, then request fields. The current unified web experience may ignore or reinterpret legacy mode hints; this has not been live-verified.

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
