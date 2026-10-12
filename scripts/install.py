#!/usr/bin/env python3
"""Install DS2API for the current user and add the `ds2api` command to PATH.

Run from a checkout with Python 3.10+:  python scripts/install.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable

APP_NAME = "DS2API"
SOURCE_ROOT = Path(__file__).resolve().parent.parent
INSTALL_MARKER = ".ds2api-install.json"
PATH_BEGIN = "# >>> DS2API PATH (managed by installer) >>>"
PATH_END = "# <<< DS2API PATH (managed by installer) <<<"
LAUNCHER_MARKER = "DS2API managed launcher"


def default_install_dir() -> Path:
    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            local_app_data = str(Path.home() / "AppData" / "Local")
        return Path(local_app_data) / "Programs" / APP_NAME
    data_home = os.environ.get("XDG_DATA_HOME")
    return (Path(data_home) if data_home else Path.home() / ".local" / "share") / "ds2api"


def make_ignore(source_root: Path) -> Callable[[str, list[str]], set[str]]:
    always_ignore = {
        ".git",
        ".venv",
        "venv",
        "env",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        ".vite",
        "node_modules",
        "dist",
        "coverage",
    }

    def ignore(directory: str, names: list[str]) -> set[str]:
        ignored = set(names) & always_ignore
        if Path(directory).resolve() == source_root:
            ignored.update(set(names) & {".env", "data"})
        return ignored

    return ignore


def copy_application(install_dir: Path) -> None:
    shutil.copytree(
        SOURCE_ROOT,
        install_dir,
        dirs_exist_ok=True,
        ignore=make_ignore(SOURCE_ROOT),
    )


def create_default_config(install_dir: Path) -> str | None:
    env_file = install_dir / ".env"
    if env_file.exists():
        return None

    example = install_dir / ".env.example"
    if not example.is_file():
        raise RuntimeError(f"Missing configuration template: {example}")

    password = secrets.token_hex(24)
    contents = example.read_text(encoding="utf-8")
    contents, replacements = re.subn(
        r"(?m)^DEEPSEEK_ADMIN_PASSWORD=.*$",
        f"DEEPSEEK_ADMIN_PASSWORD={password}",
        contents,
        count=1,
    )
    if replacements != 1:
        raise RuntimeError("Could not set a generated admin password in .env.example")

    env_file.write_text(contents, encoding="utf-8", newline="\n")
    if os.name != "nt":
        env_file.chmod(0o600)
    return password


def ensure_virtualenv(install_dir: Path) -> Path:
    venv_dir = install_dir / ".venv"
    python = venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.is_file():
        subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)
    return python


def npm_command(npm_path: str, arguments: list[str], cwd: Path) -> None:
    if os.name == "nt":
        command_line = subprocess.list2cmdline([npm_path, *arguments])
        command = os.environ.get("COMSPEC", "cmd.exe")
        subprocess.run([command, "/d", "/s", "/c", command_line], cwd=cwd, check=True)
    else:
        subprocess.run([npm_path, *arguments], cwd=cwd, check=True)


def build_webui(install_dir: Path, skip_webui: bool) -> bool:
    webui = install_dir / "webui-new"
    built_index = webui / "dist" / "index.html"
    if skip_webui:
        return built_index.is_file()

    node = shutil.which("node")
    npm = shutil.which("npm") or (shutil.which("npm.cmd") if os.name == "nt" else None)
    if not node or not npm:
        print("[warning] Node.js 20+ and npm were not found; installing API-only. Install Node.js and rerun to build the WebUI.")
        return built_index.is_file()

    version = subprocess.run([node, "--version"], capture_output=True, text=True, check=True).stdout.strip()
    match = re.match(r"v?(\d+)", version)
    if not match or int(match.group(1)) < 20:
        print(f"[warning] Node.js 20+ is required for the WebUI build (found {version or 'unknown'}); installing API-only.")
        return built_index.is_file()

    if not (webui / "package-lock.json").is_file():
        raise RuntimeError(f"WebUI lockfile is missing: {webui / 'package-lock.json'}")

    print("[webui] Installing npm dependencies...")
    npm_command(npm, ["ci", "--no-audit", "--no-fund"], webui)
    print("[webui] Building the admin interface...")
    npm_command(npm, ["run", "build"], webui)
    if not built_index.is_file():
        raise RuntimeError("WebUI build finished without producing webui-new/dist/index.html")

    # The built static files are needed at runtime; npm's development packages are not.
    shutil.rmtree(webui / "node_modules", ignore_errors=True)
    return True


def windows_launcher() -> str:
    return r'''@echo off
setlocal
rem DS2API managed launcher
set "DS2API_HOME=%~dp0.."
for %%I in ("%DS2API_HOME%") do set "DS2API_HOME=%%~fI"
set "DS2API_PYTHON=%DS2API_HOME%\.venv\Scripts\python.exe"
if not exist "%DS2API_PYTHON%" (
  echo DS2API Python environment is missing. Rerun the installer.
  exit /b 1
)
pushd "%DS2API_HOME%"
"%DS2API_PYTHON%" "%DS2API_HOME%\scripts\ds2api.py" %*
set "DS2API_EXIT=%ERRORLEVEL%"
popd
exit /b %DS2API_EXIT%
'''


def posix_launcher(install_dir: Path) -> str:
    app_home = shlex.quote(str(install_dir))
    return f'''#!/bin/sh
# {LAUNCHER_MARKER}
set -eu
DS2API_HOME={app_home}
DS2API_PYTHON="$DS2API_HOME/.venv/bin/python"
if [ ! -x "$DS2API_PYTHON" ]; then
  echo "DS2API Python environment is missing. Rerun the installer." >&2
  exit 1
fi
exec "$DS2API_PYTHON" "$DS2API_HOME/scripts/ds2api.py" "$@"
'''


def ensure_launcher(install_dir: Path, bin_dir: Path) -> None:
    bin_dir.mkdir(parents=True, exist_ok=True)
    launcher = bin_dir / ("ds2api.cmd" if os.name == "nt" else "ds2api")
    if launcher.exists():
        existing = launcher.read_text(encoding="utf-8", errors="replace")
        if LAUNCHER_MARKER not in existing:
            raise RuntimeError(
                f"Refusing to replace an unrelated command at {launcher}. "
                "Rename it or choose another installation location."
            )
    content = windows_launcher() if os.name == "nt" else posix_launcher(install_dir)
    launcher.write_text(content, encoding="utf-8", newline="\n")
    if os.name != "nt":
        launcher.chmod(0o755)


def _replace_managed_block(text: str, block: str) -> str:
    start = text.find(PATH_BEGIN)
    end = text.find(PATH_END, start + len(PATH_BEGIN)) if start >= 0 else -1
    if start >= 0 and end >= 0:
        end += len(PATH_END)
        result = text[:start] + block.rstrip() + text[end:]
    else:
        separator = "\n" if text and not text.endswith("\n") else ""
        result = text + separator + ("\n" if text.strip() else "") + block.rstrip() + "\n"
    return result


def _shell_path_block(bin_dir: Path, fish: bool = False) -> str:
    if fish:
        path_literal = "'" + str(bin_dir).replace("\\", "\\\\").replace("'", "\\'") + "'"
        body = f"""set -l _ds2api_bin {path_literal}
if not contains -- $_ds2api_bin $PATH
    fish_add_path --global $_ds2api_bin
end
set -e _ds2api_bin"""
    else:
        path_literal = shlex.quote(str(bin_dir))
        body = f"""_ds2api_bin={path_literal}
case ":${{PATH-}}:" in
    *":${{_ds2api_bin}}:"*) ;;
    *) export PATH="${{_ds2api_bin}}:${{PATH-}}" ;;
esac
unset _ds2api_bin"""
    return f"{PATH_BEGIN}\n{body}\n{PATH_END}"


def add_posix_user_path(bin_dir: Path) -> list[Path]:
    home = Path.home()
    shell = Path(os.environ.get("SHELL", "")).name.lower()
    if shell == "zsh":
        profiles = [home / ".zprofile", home / ".zshrc"]
        block = _shell_path_block(bin_dir)
    elif shell == "fish":
        profiles = [home / ".config" / "fish" / "config.fish"]
        block = _shell_path_block(bin_dir, fish=True)
    elif shell in {"bash", "sh", "dash", "ksh"} or not shell:
        profiles = [home / ".profile", home / ".bashrc"]
        block = _shell_path_block(bin_dir)
    else:
        profiles = [home / ".profile"]
        block = _shell_path_block(bin_dir)
        print(f"[warning] PATH was added to ~/.profile; {shell} may use a different startup file.")

    for profile in profiles:
        profile.parent.mkdir(parents=True, exist_ok=True)
        old = profile.read_text(encoding="utf-8", errors="replace") if profile.exists() else ""
        updated = _replace_managed_block(old, block)
        profile.write_text(updated, encoding="utf-8", newline="\n")
    return profiles


def _normalized_path_entry(entry: str) -> str:
    expanded = os.path.expandvars(entry.strip().strip('"'))
    return os.path.normcase(os.path.normpath(expanded)) if expanded else ""


def add_windows_user_path(bin_dir: Path) -> bool:
    import winreg

    registry_key = r"Environment"
    with winreg.CreateKeyEx(
        winreg.HKEY_CURRENT_USER,
        registry_key,
        0,
        winreg.KEY_READ | winreg.KEY_WRITE,
    ) as key:
        try:
            current, value_type = winreg.QueryValueEx(key, "Path")
        except FileNotFoundError:
            current, value_type = "", winreg.REG_EXPAND_SZ

        entries = [entry for entry in current.split(";") if entry.strip()]
        wanted = _normalized_path_entry(str(bin_dir))
        if any(_normalized_path_entry(entry) == wanted for entry in entries):
            return False

        updated = ";".join([*entries, str(bin_dir)])
        if len(updated) >= 32767:
            raise RuntimeError("The Windows user PATH is near its size limit; remove unused entries before installing.")
        if value_type not in {winreg.REG_SZ, winreg.REG_EXPAND_SZ}:
            value_type = winreg.REG_EXPAND_SZ
        winreg.SetValueEx(key, "Path", 0, value_type, updated)
    _broadcast_windows_environment_change()
    return True


def _broadcast_windows_environment_change() -> None:
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.WinDLL("user32", use_last_error=True)
        send_message = user32.SendMessageTimeoutW
        send_message.argtypes = [
            wintypes.HWND,
            wintypes.UINT,
            wintypes.WPARAM,
            wintypes.LPCWSTR,
            wintypes.UINT,
            wintypes.UINT,
            ctypes.POINTER(wintypes.DWORD),
        ]
        send_message.restype = wintypes.LPARAM
        result = wintypes.DWORD()
        send_message(
            wintypes.HWND(0xFFFF),
            0x001A,  # WM_SETTINGCHANGE
            0,
            "Environment",
            0x0002,  # SMTO_ABORTIFHUNG
            5000,
            ctypes.byref(result),
        )
    except (AttributeError, OSError):
        # Registry changes still apply to newly started processes after sign-in.
        pass


def remove_windows_user_path(bin_dir: Path) -> bool:
    import winreg

    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Environment",
            0,
            winreg.KEY_READ | winreg.KEY_WRITE,
        )
    except FileNotFoundError:
        return False

    with key:
        try:
            current, value_type = winreg.QueryValueEx(key, "Path")
        except FileNotFoundError:
            return False
        wanted = _normalized_path_entry(str(bin_dir))
        entries = current.split(";")
        remaining = [entry for entry in entries if _normalized_path_entry(entry) != wanted]
        if len(remaining) == len(entries):
            return False
        updated = ";".join(entry for entry in remaining if entry.strip())
        if updated:
            winreg.SetValueEx(key, "Path", 0, value_type, updated)
        else:
            winreg.DeleteValue(key, "Path")
    _broadcast_windows_environment_change()
    return True


def _remove_managed_block(text: str) -> str:
    start = text.find(PATH_BEGIN)
    end = text.find(PATH_END, start + len(PATH_BEGIN)) if start >= 0 else -1
    if start < 0 or end < 0:
        return text
    end += len(PATH_END)
    if text[end:end + 2] == "\r\n":
        end += 2
    elif text[end:end + 1] == "\n":
        end += 1
    return text[:start] + text[end:]


def remove_posix_user_path() -> list[Path]:
    home = Path.home()
    profiles = [
        home / ".profile",
        home / ".bashrc",
        home / ".zprofile",
        home / ".zshrc",
        home / ".config" / "fish" / "config.fish",
    ]
    changed: list[Path] = []
    for profile in profiles:
        if not profile.is_file():
            continue
        old = profile.read_text(encoding="utf-8", errors="replace")
        updated = _remove_managed_block(old)
        if updated != old:
            profile.write_text(updated, encoding="utf-8", newline="\n")
            changed.append(profile)
    return changed


def remove_user_path(bin_dir: Path) -> None:
    if os.name == "nt":
        removed = remove_windows_user_path(bin_dir)
        print("[path] Removed DS2API from the current user's Windows PATH." if removed else "[path] No DS2API PATH entry was found.")
        print("[path] Open a new terminal for the change to take effect.")
    else:
        profiles = remove_posix_user_path()
        print("[path] Removed DS2API PATH block from: " + (", ".join(str(profile) for profile in profiles) if profiles else "no shell profiles"))


def update_user_path(bin_dir: Path) -> None:
    if os.name == "nt":
        added = add_windows_user_path(bin_dir)
        print("[path] Added DS2API to the current user's Windows PATH." if added else "[path] DS2API is already on the current user's PATH.")
        print("[path] Open a new terminal for the updated PATH to take effect.")
    else:
        profiles = add_posix_user_path(bin_dir)
        print("[path] Added DS2API to: " + ", ".join(str(profile) for profile in profiles))
        print("[path] Open a new terminal (or source your shell profile) for PATH to take effect.")


def validate_install_dir(install_dir: Path) -> None:
    if (
        install_dir == SOURCE_ROOT
        or SOURCE_ROOT in install_dir.parents
        or install_dir in SOURCE_ROOT.parents
    ):
        raise RuntimeError("Install into a separate directory, not inside or above the source checkout.")
    if install_dir == Path(install_dir.anchor):
        raise RuntimeError("Refusing to install at a filesystem root.")
    if install_dir.exists() and any(install_dir.iterdir()):
        marker = install_dir / INSTALL_MARKER
        if not marker.exists():
            raise RuntimeError(
                f"{install_dir} is not empty and is not marked as a DS2API installation. "
                "Back it up or choose a different installation directory."
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Install DS2API for the current user and add `ds2api` to PATH.")
    parser.add_argument("--install-dir", type=Path, default=default_install_dir(), help="application folder (default: user-local application data)")
    parser.add_argument("--skip-webui", action="store_true", help="do not build the WebUI; install the API only")
    args = parser.parse_args()

    if sys.version_info < (3, 10):
        raise RuntimeError("Python 3.10 or newer is required to install DS2API.")
    if not (SOURCE_ROOT / "requirements.txt").is_file() or not (SOURCE_ROOT / "server.py").is_file():
        raise RuntimeError("Run this installer from a complete DS2API source checkout.")

    install_dir = args.install_dir.expanduser().resolve()
    validate_install_dir(install_dir)
    bin_dir = install_dir / "bin" if os.name == "nt" else Path.home() / ".local" / "bin"

    print(f"Installing DS2API for the current user to: {install_dir}")
    install_dir.mkdir(parents=True, exist_ok=True)
    marker = {
        "name": "DS2API",
        "install_dir": str(install_dir),
        "bin_dir": str(bin_dir),
        "installer_version": 1,
    }
    (install_dir / INSTALL_MARKER).write_text(json.dumps(marker, indent=2) + "\n", encoding="utf-8")
    if os.name != "nt":
        (install_dir / INSTALL_MARKER).chmod(0o600)

    copy_application(install_dir)
    password = create_default_config(install_dir)

    data_dir = install_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    if os.name != "nt":
        data_dir.chmod(0o700)

    venv_python = ensure_virtualenv(install_dir)
    print("[python] Installing application dependencies...")
    subprocess.run(
        [str(venv_python), "-m", "pip", "install", "--disable-pip-version-check", "-r", str(install_dir / "requirements.txt")],
        check=True,
    )

    webui_ready = build_webui(install_dir, args.skip_webui)
    ensure_launcher(install_dir, bin_dir)
    update_user_path(bin_dir)

    print("\nInstallation complete.")
    if os.name == "nt":
        print("Open a new Command Prompt or PowerShell window and run: ds2api")
    else:
        print("Open a new terminal and run: ds2api")
    print("The service uses the HOST and PORT in .env (default: 127.0.0.1:8080).")
    if webui_ready:
        print("WebUI: http://127.0.0.1:8080/webui/")
    else:
        print("WebUI was not built. Install Node.js 20+ and rerun the installer, or use --skip-webui for API-only setup.")
    print(f"Configuration: {install_dir / '.env'}")
    if password:
        print("\nGenerated admin password (shown once; also stored in .env):")
        print(password)
        print("Save it somewhere secure before closing this terminal.")
    else:
        print("Existing .env and account data were preserved.")
    print("Rerun this installer to update application files; .env and data/ are preserved.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, subprocess.CalledProcessError, RuntimeError) as exc:
        print(f"[install error] {exc}", file=sys.stderr)
        raise SystemExit(1)
