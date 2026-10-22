# Maintainer Notes — DeepSeek Web Chat API Proxy

This file documents the current implementation for maintainers and coding agents. User-facing setup instructions are in `README.md` (Persian, the default) and `README_en.md` (English), both written in plain language. The detailed English reference is `docs/technical-guide-en.md`; release history is in `docs/release-notes/`.

## Scope and compatibility

- The upstream adapter targets the **private web-chat protocol** at `https://chat.deepseek.com`, not the official `https://api.deepseek.com` API.
- Upstream calls require a DeepSeek web-account token and cookies. The adapter solves the web client's proof-of-work challenge and parses the web app's SSE protocol.
- The protocol is undocumented and may change independently of this repository. Do not claim live compatibility without testing against a real account and current web app.
- As of 2026-10-11, DeepSeek's official API lists `deepseek-flash` as V4.1-Flash with native vision and `deepseek-v4-pro` as V4-Pro-0813 (text only); the current official changelog says Pro API service continues with billing unchanged. DeepSeek's web app is reported to combine prior quick/expert/vision modes into an adaptive Flash experience, but that product report does not specify the private request protocol.
- The checked-in proxy config exposes only `deepseek-flash` as a local `default`-mode hint. The optional `expert` value remains for compatibility, but may no longer select a separate mode. This proxy does not call the official API, does not guarantee the web app's model selection, and currently forwards text only; image upload/content conversion is not implemented.
- Current release: v3.5.0. Key release notes: `docs/release-notes/v3.5.0.md`.

## Repository layout

| Path | Responsibility |
|---|---|
| `server.py` | FastAPI app, auth, OpenAI/Anthropic routes, session orchestration, streaming response assembly, WebUI static serving. |
| `adapter.py` | Private web protocol, proof-of-work, session creation, upstream requests, SSE parsing, retry/error handling. |
| `model_router.py` | Client-facing model alias to `default` / `expert` mode mapping, with optional thinking/search overrides. |
| `anthropic_format.py` | Anthropic Messages request parsing, prompt construction, response blocks, and SSE events. |
| `tool_dsml.py` | DSML prompt generation and tool-call parsing. |
| `tool_sieve.py` | Incremental DSML tool-call detection for streaming output. |
| `account_pool.py` | Account persistence, state, round-robin selection, health checks, and recovery. |
| `session_cache.py` | Caller-scoped, account-bound upstream session cache. |
| `admin.py` | Admin auth/API, API-key management, account CRUD, runtime config and request statistics. |
| `api_key_store.py` | SQLite client API-key storage; only hashes are persisted. |
| `crypto.py` | Optional Fernet encryption for account storage. |
| `webui-new/` | React/TypeScript dashboard, playground, account pool, and settings UI. Build output is `webui-new/dist/`. |
| `sha3_wasm_bg.wasm` | WASM module used by the upstream proof-of-work solver. |
| `tests/` | Offline unit and smoke tests. They do not call DeepSeek. |
| `scripts/run_e2e.py` | Offline end-to-end checks using isolated subprocesses. |

## Request and model flow

1. `/v1/chat/completions` or `/v1/messages` authenticates the client API key, checks rate limits, and validates the request.
2. `model_router.ModelRouter` resolves a configured `model` alias to a private web-chat `model_type` hint (`default` or legacy `expert`). An exact route can also override thinking and search settings; the current upstream meaning of these hints is unverified.
3. `MODE` is the fallback for unmatched model IDs. `THINKING` and `SEARCH` use route overrides first, then environment settings when set to `enabled` or `disabled`, and otherwise the request fields.
4. The server converts OpenAI or Anthropic messages into the plain-text prompt used by the web client. Image/multimodal input is explicitly rejected with HTTP 400 rather than silently discarded.
5. `AcquiredAccount` selects an account and, when a stable caller identifier is supplied, may reuse an upstream session belonging to that same account.
6. `DeepSeekAdapter` obtains/solves proof of work, creates or reuses a chat session, sends `/api/v0/chat/completion`, and decodes the upstream event stream.
7. `StreamSieve` buffers possible DSML prefixes and separates ordinary text from tool-call markup. OpenAI or Anthropic response events are then emitted.

### Model aliases

The checked-in `.env.example` uses:

```ini
MODEL_NAME=deepseek-flash
MODEL_ROUTES={"deepseek-flash":"default"}
```

`deepseek-flash` is a client-facing proxy alias, not an upstream official API request parameter. Add or edit aliases in `MODEL_ROUTES` to select private web-chat mode hints. The `expert` hint remains configurable for compatibility, but should not be presented as the official `deepseek-v4-pro` model or as a verified current web mode. A response echoes the model ID requested by the client; when the client omits it, the response uses `MODEL_NAME`. This echo is compatibility behavior, not a verified upstream model identity.

Do not silently map multimodal API requests to text prompts. Keep the documented text-only limitation explicit unless multimodal request conversion and tests are implemented.

## Upstream adapter notes

- Upstream constants, captured headers, `X-Client-Version`, browser fingerprint, and the WASM export names live in `adapter.py`. The adapter requests English notices with `Accept-Language: en-US` and `X-Client-Locale: en_US`. Other private-protocol header values were last captured on 2026-08-02 and are not live-verified for the current frontend.
- `DEEPSEEK_IMPERSONATE` controls the curl_cffi browser/TLS impersonation profile. Its default profile and the user-agent/client-hint values must stay mutually consistent. Update them only after validating that the installed curl_cffi release supports the profile.
- HIF signature values are fetched best-effort and cached according to the upstream TTL. A failed HIF lookup should not fail a chat request.
- The WASM solver is guarded by a lock and reuses a Wasmtime instance. If the upstream changes its proof-of-work challenge or WASM exports, update the module and its export handling together.
- Upstream error hints can arrive as SSE events or as a plain JSON response. Preserve rate-limit, account-mute, and empty-response handling when changing the parser.
- The adapter has retry/backoff behavior controlled by `DEEPSEEK_RATE_LIMIT_RETRY_DELAYS` and `DEEPSEEK_JITTER_SECS`. Retrying should use a fresh session and must not retain a `parent_message_id` from the old session.
- Never add real account tokens, cookies, challenge responses, HAR captures, or account data to Git.

### Upstream request and proof-of-work lifecycle

These details describe the current adapter implementation, not a stable DeepSeek contract:

1. `DeepSeekAdapter._get_challenge()` requests a challenge for the completion target path. The solver consumes the upstream challenge, salt, expiry, difficulty, and signature fields.
2. `_WASMSolver` uses the checked-in `sha3_wasm_bg.wasm` module; a lock protects the shared Wasmtime store/instance. `_solve()` encodes a `DeepSeekHashV1` proof payload as base64 for `X-DS-PoW-Response`.
3. `create_session()` creates a web-chat session. Completion requests include the selected `model_type`, prompt, thinking/search flags, and the current `parent_message_id` when reusing a session.
4. Completion requests fetch HIF signatures best-effort. `_HifProvider` reads the response value and TTL from the private HIF endpoints, caches each value, and must degrade gracefully if the endpoints fail.
5. The adapter recognizes WAF/CDN challenge responses and upstream `toast` / `hint` error events. Rate-limit hints and account-mute JSON are distinct from generic protocol errors; keep their retry and HTTP-status mapping intact.
6. A successful response's upstream message ID is captured from the `ready` event or the compatible non-streaming response shape. Pass it through `ready_out` so the session cache can continue the correct parent chain.

Do not use these notes as evidence of current live compatibility. Validate changes against a real account only when authorized access is available.

## Streaming and format invariants

- OpenAI streams end with an explicit finish chunk and `data: [DONE]`. Keep the requested model alias consistent on every chunk, including reasoning, tool-call, finish, and error chunks.
- Anthropic streams use `message_start`, content-block, `message_delta`, and `message_stop` events. Preserve the requested model ID in the returned message.
- `reasoning_content` is emitted separately from answer text when upstream reasoning fragments are present; do not assume it is tied to a distinct expert model.
- DSML tool calling is prompt-based and best-effort. Do not describe it as native function calling or promise strict `tool_choice` behavior.
- OpenAI `usage` values are local estimates, not official upstream billing counts. Anthropic usage is currently returned as `-1` because the private web protocol does not provide compatible token counts.
- `temperature`, `top_p`, and `max_tokens` are accepted for client compatibility but are not forwarded to the web endpoint.

## Session and account invariants

- Account credentials are loaded from `ACCOUNT_STORE_PATH` (default `data/accounts.json`) and managed through the WebUI/Admin API. They are not loaded from `.env`.
- Client API keys are managed in the admin UI and stored as hashes in SQLite. Legacy `API_KEYS` / `DEEPSEEK_API_KEY` settings are imported only during initial key-store creation.
- Explicit caller identifiers isolate conversations: OpenAI `X-Conversation-Id` or `user`, or Anthropic `metadata.user_id`. By default, requests without an ID share one upstream session per authenticated API key (`SESSION_CACHE_FALLBACK=per_caller`) for clients that resend full history; disable this with `SESSION_CACHE_FALLBACK=none` when separate threads must stay isolated.
- Cache entries are scoped to the API key (hashed) or the caller IP and are bound to the account that created the upstream session. Never submit one account's session ID/parent chain using another account's credentials.
- `prepare_prompt()` must run before `create_session()`. It returns only the new tail for a continued conversation, invalidates a divergent history, and prevents repeated full-history submission.
- Successful turns must persist the actual upstream `response_message_id` and the session ID used after any retry. `ready_out` carries these values from the adapter to the session cache.
- Streaming and non-streaming caches are intentionally separated because the upstream may not permit cross-mode session reuse.
- Always release both the acquired pool account and the global upstream concurrency slot, including error and cancellation paths.

## Security and deployment

- Default bind is loopback. A public bind with a weak/default admin password is refused unless `ALLOW_INSECURE_PUBLIC_DEFAULTS=true` is explicitly set; do not weaken this safeguard.
- Keep API authentication enabled on public deployments. Do not enable `ALLOW_UNAUTHENTICATED_API` outside isolated local development.
- CORS is same-origin by default. Configure `ALLOWED_ORIGINS` narrowly when cross-origin browser access is required; never combine wildcard origins with credentialed access.
- Only trust `X-Forwarded-For` from configured `TRUSTED_PROXIES`.
- Recommend `DEEPSEEK_ENCRYPTION_KEY` for account credential storage. Do not log secrets or return them from Admin API responses.
- Preserve WebUI path-traversal protection and the default restrictive response headers/CSP.

## WebUI notes

- Source lives in `webui-new/src`; the server serves production output from `webui-new/dist` under `/webui/`.
- Build with `cd webui-new && npm ci && npm run build`.
- Keep `vite.config.ts` base path `/webui/` and the React Router basename `/webui` aligned. A mismatch produces asset 404s or a blank page.
- User-facing copy and accessibility labels must remain in English. The backend account state values are `idle`, `busy`, and `error`; the WebUI maps them to English labels.
- Playground fields should only expose parameters that the backend actually uses. The model selector lists the model aliases from `/v1/models`.
- Playground model, system prompt, thinking, and search preferences persist in the browser's `ds2api-playground-settings` localStorage entry; conversation messages are intentionally not persisted.

## Configuration notes

The complete template is `.env.example`. Important defaults and behavior:

| Variable | Current default | Notes |
|---|---|---|
| `HOST` / `PORT` | `127.0.0.1` / `8080` | Loopback is the safe default. |
| `MODEL_NAME` | `deepseek-flash` | Fallback model ID for responses and `/v1/models` when no route is configured. |
| `MODEL_ROUTES` | `{"deepseek-flash":"default"}` | Local alias-to-private-hint map; optional `expert` is legacy/unverified. |
| `MODE` | `auto` | Proxy-side fallback hint; `expert` is legacy and its current upstream effect is unverified. |
| `THINKING` / `SEARCH` | `auto` | `auto`, `enabled`, or `disabled`. |
| `SESSION_CACHE_TTL` | `1800` seconds | `0` disables upstream session reuse. |
| `DEEPSEEK_MAX_CONCURRENCY` | `2` | Global upstream concurrency limit across accounts. |
| `CLIENT_RPM_PER_KEY` / `CLIENT_RPM_PER_IP` | `60` / `120` | Set a dimension to `0` to disable its cap. |
| `DEEPSEEK_IMPERSONATE` | `chrome131` | curl_cffi impersonation profile. |
| `DEEPSEEK_JITTER_SECS` | `0.4` seconds | Set `0` to disable the delay. |
| `DEEPSEEK_RATE_LIMIT_RETRY_DELAYS` | `5,15` | Comma-separated backoff delays; empty disables retries. |
| `ACCOUNT_STORE_PATH` | `data/accounts.json` | Persistent account pool file. |
| `DEEPSEEK_ENCRYPTION_KEY` | unset | Fernet key for encryption at rest. |

Module-level environment settings are loaded at server startup. Restart the server after editing `.env`.

## Test and validation commands

Run from the repository root:

```bash
python -m pip install -r requirements.txt
python -m pytest
python -m tests.smoke
python scripts/run_e2e.py
cd webui-new && npm ci && npm run build
```

The tests are designed to run without real account credentials and without calls to DeepSeek. A green suite verifies local behavior only; it does not prove that the private upstream protocol is currently accepted.

CI is defined in `.github/workflows/ci.yml`. It runs the smoke suite, selected unit tests, the offline e2e harness, and the WebUI TypeScript/Vite build.

## Release notes

User-visible and implementation changes are recorded in `docs/release-notes/`. The most recent release is `v3.5.0`; its release notes describe the beginner-friendly documentation rewrite, the new Persian default README, and the detailed English guide moving to `docs/technical-guide-en.md`.
