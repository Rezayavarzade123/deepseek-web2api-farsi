#!/usr/bin/env python3
"""Start DS2API from its installed directory."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent


def _webui_url(host: str, port: int) -> str:
    if host == "0.0.0.0":
        display_host = "127.0.0.1"
    elif host == "::":
        display_host = "::1"
    else:
        display_host = host
    if ":" in display_host and not display_host.startswith("["):
        display_host = f"[{display_host}]"
    return f"http://{display_host}:{port}/webui/"


def main() -> int:
    os.chdir(APP_ROOT)
    if str(APP_ROOT) not in sys.path:
        sys.path.insert(0, str(APP_ROOT))

    from dotenv import load_dotenv

    load_dotenv(APP_ROOT / ".env")

    parser = argparse.ArgumentParser(description="Run the local DS2API server.")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"), help="bind address (default: HOST from .env)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")), help="port (default: PORT from .env)")
    args = parser.parse_args()

    import server
    import uvicorn

    # Keep the server's public-bind safety check in sync with CLI overrides.
    server.HOST = args.host
    server.PORT = args.port
    server._validate_startup()

    print(f"\nWebUI URL: {_webui_url(args.host, args.port)}", flush=True)
    print(
        f"WebUI admin password: {os.environ.get('DEEPSEEK_ADMIN_PASSWORD', 'admin')}",
        flush=True,
    )
    print(
        "Use this password to sign in to the WebUI. Keep it private; change it before exposing DS2API to a network.\n",
        flush=True,
    )

    uvicorn.run(server.app, host=args.host, port=args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
