#!/usr/bin/env python3
"""Remove a per-user DS2API installation while preserving config and accounts."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

from install import INSTALL_MARKER, LAUNCHER_MARKER, remove_user_path

APP_ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    parser = argparse.ArgumentParser(description="Uninstall the current per-user DS2API installation.")
    parser.add_argument("--install-dir", type=Path, default=APP_ROOT, help="DS2API install folder (default: this script's installation)")
    parser.add_argument("--purge-user-data", action="store_true", help="also delete .env and data/ (account credentials and settings)")
    parser.add_argument("-y", "--yes", action="store_true", help="do not ask for confirmation")
    args = parser.parse_args()

    install_dir = args.install_dir.expanduser().resolve()
    marker_file = install_dir / INSTALL_MARKER
    if not marker_file.is_file():
        raise RuntimeError(f"No DS2API install marker found in {install_dir}; refusing to remove files.")

    marker = json.loads(marker_file.read_text(encoding="utf-8"))
    recorded_dir = Path(marker.get("install_dir", "")).expanduser().resolve()
    if recorded_dir != install_dir:
        raise RuntimeError("Install marker path does not match the requested directory; refusing to continue.")

    bin_dir = Path(marker.get("bin_dir", install_dir / "bin")).expanduser()
    launcher = bin_dir / ("ds2api.cmd" if os.name == "nt" else "ds2api")
    data_note = "and permanently delete .env and data/" if args.purge_user_data else "while preserving .env and data/"
    if not args.yes:
        answer = input(f"Remove DS2API from PATH and uninstall {install_dir} {data_note}? [y/N] ").strip().lower()
        if answer not in {"y", "yes"}:
            print("Uninstall canceled.")
            return 0

    remove_user_path(bin_dir)
    if launcher.is_file():
        content = launcher.read_text(encoding="utf-8", errors="replace")
        if LAUNCHER_MARKER in content:
            launcher.unlink()

    if args.purge_user_data:
        shutil.rmtree(install_dir)
        print("DS2API and its configuration/account data were removed.")
        return 0

    preserve = {".env", "data", INSTALL_MARKER}
    for child in install_dir.iterdir():
        if child.name in preserve:
            continue
        if child.is_symlink() or not child.is_dir():
            child.unlink()
        else:
            shutil.rmtree(child)

    print(f"DS2API application files were removed. Configuration and account data remain in {install_dir}.")
    print("To delete the remaining .env and data/ later, remove those items and the now-empty install folder manually.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"[uninstall error] {exc}", file=sys.stderr)
        raise SystemExit(1)
