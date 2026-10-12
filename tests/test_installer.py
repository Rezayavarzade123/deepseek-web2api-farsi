from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import types
from pathlib import Path

import pytest

from scripts import ds2api, install


def test_installer_generates_admin_password_once_and_preserves_existing_env(tmp_path: Path) -> None:
    (tmp_path / ".env.example").write_text(
        "HOST=127.0.0.1\nDEEPSEEK_ADMIN_PASSWORD=admin\n",
        encoding="utf-8",
    )

    password = install.create_default_config(tmp_path)
    env_file = tmp_path / ".env"
    assert password is not None
    assert re.fullmatch(r"[0-9a-f]{48}", password)
    assert f"DEEPSEEK_ADMIN_PASSWORD={password}" in env_file.read_text(encoding="utf-8")

    env_file.write_text("CUSTOM_SETTING=keep-me\n", encoding="utf-8")
    assert install.create_default_config(tmp_path) is None
    assert env_file.read_text(encoding="utf-8") == "CUSTOM_SETTING=keep-me\n"


def test_installer_refuses_to_merge_an_unmarked_nonempty_directory(tmp_path: Path) -> None:
    install_dir = tmp_path / "unmanaged"
    install_dir.mkdir()
    (install_dir / "keep.txt").write_text("user file", encoding="utf-8")

    with pytest.raises(RuntimeError, match="not empty and is not marked"):
        install.validate_install_dir(install_dir)
    assert (install_dir / "keep.txt").read_text(encoding="utf-8") == "user file"


def test_posix_path_block_is_idempotent_and_removable(tmp_path: Path, monkeypatch) -> None:
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("SHELL", "/bin/bash")
    bin_dir = tmp_path / "local-bin"

    first = install.add_posix_user_path(bin_dir)
    second = install.add_posix_user_path(bin_dir)
    assert first == second
    for profile in first:
        text = profile.read_text(encoding="utf-8")
        assert text.count(install.PATH_BEGIN) == 1
        assert str(bin_dir) in text

    changed = install.remove_posix_user_path()
    assert set(changed) == set(first)
    for profile in first:
        assert install.PATH_BEGIN not in profile.read_text(encoding="utf-8")


def test_installer_copy_filter_keeps_runtime_files_but_excludes_local_secrets(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    (source / ".env").touch()
    (source / "data").mkdir()
    (source / ".git").mkdir()
    (source / "server.py").touch()
    (source / "webui-new").mkdir()
    (source / "webui-new" / "node_modules").mkdir()

    ignored = install.make_ignore(source)(str(source), [".env", "data", ".git", "server.py", "webui-new"])
    assert {".env", "data", ".git"} <= ignored
    assert "server.py" not in ignored

    nested_ignored = install.make_ignore(source)(str(source / "webui-new"), ["node_modules", "package.json"])
    assert "node_modules" in nested_ignored
    assert "package.json" not in nested_ignored


def test_windows_launcher_is_self_contained() -> None:
    launcher = install.windows_launcher()
    assert install.LAUNCHER_MARKER in launcher
    assert "%~dp0.." in launcher
    assert "scripts\\ds2api.py" in launcher
    assert "setlocal" in launcher


def test_cli_validates_overridden_bind_before_starting_server(monkeypatch) -> None:
    events: list[tuple[str, str, int]] = []
    fake_server = types.ModuleType("server")
    fake_server.HOST = "127.0.0.1"
    fake_server.PORT = 8080
    fake_server.app = object()

    def validate() -> None:
        events.append(("validate", fake_server.HOST, fake_server.PORT))

    fake_server._validate_startup = validate
    fake_uvicorn = types.ModuleType("uvicorn")
    fake_uvicorn.run = lambda app, host, port: events.append(("run", host, port))
    monkeypatch.setitem(sys.modules, "server", fake_server)
    monkeypatch.setitem(sys.modules, "uvicorn", fake_uvicorn)
    monkeypatch.setattr(sys, "argv", ["ds2api", "--host", "0.0.0.0", "--port", "9000"])

    previous_directory = Path.cwd()
    try:
        assert ds2api.main() == 0
    finally:
        os.chdir(previous_directory)

    assert events == [
        ("validate", "0.0.0.0", 9000),
        ("run", "0.0.0.0", 9000),
    ]


def _create_fake_install(install_dir: Path, bin_dir: Path) -> None:
    install_dir.mkdir(parents=True)
    (install_dir / ".env").write_text("SECRET=keep\n", encoding="utf-8")
    (install_dir / "data").mkdir()
    (install_dir / "data" / "accounts.json").write_text("[]\n", encoding="utf-8")
    (install_dir / "server.py").write_text("# app file\n", encoding="utf-8")
    marker = {
        "name": "DS2API",
        "install_dir": str(install_dir),
        "bin_dir": str(bin_dir),
        "installer_version": 1,
    }
    (install_dir / install.INSTALL_MARKER).write_text(json.dumps(marker), encoding="utf-8")
    bin_dir.mkdir(parents=True)
    launcher = bin_dir / "ds2api"
    launcher.write_text(f"#!/bin/sh\n# {install.LAUNCHER_MARKER}\n", encoding="utf-8")


@pytest.mark.skipif(os.name == "nt", reason="The uninstaller integration exercises POSIX shell profiles.")
def test_uninstaller_removes_app_and_path_but_preserves_user_data(tmp_path: Path, monkeypatch) -> None:
    home = tmp_path / "home"
    home.mkdir()
    install_dir = tmp_path / "app"
    bin_dir = home / ".local" / "bin"
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("SHELL", "/bin/bash")
    _create_fake_install(install_dir, bin_dir)
    profiles = install.add_posix_user_path(bin_dir)

    result = subprocess.run(
        [sys.executable, str(install.SOURCE_ROOT / "scripts" / "uninstall.py"), "--install-dir", str(install_dir), "--yes"],
        capture_output=True,
        text=True,
        check=True,
        env=os.environ.copy(),
    )

    assert "remain in" in result.stdout
    assert (install_dir / ".env").read_text(encoding="utf-8") == "SECRET=keep\n"
    assert (install_dir / "data" / "accounts.json").read_text(encoding="utf-8") == "[]\n"
    assert (install_dir / install.INSTALL_MARKER).is_file()
    assert not (install_dir / "server.py").exists()
    assert not (bin_dir / "ds2api").exists()
    for profile in profiles:
        assert install.PATH_BEGIN not in profile.read_text(encoding="utf-8")


@pytest.mark.skipif(os.name == "nt", reason="The uninstaller integration exercises POSIX shell profiles.")
def test_uninstaller_purge_removes_configuration_and_accounts(tmp_path: Path, monkeypatch) -> None:
    home = tmp_path / "home"
    home.mkdir()
    install_dir = tmp_path / "app"
    bin_dir = home / ".local" / "bin"
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("SHELL", "/bin/bash")
    _create_fake_install(install_dir, bin_dir)
    install.add_posix_user_path(bin_dir)

    subprocess.run(
        [
            sys.executable,
            str(install.SOURCE_ROOT / "scripts" / "uninstall.py"),
            "--install-dir",
            str(install_dir),
            "--purge-user-data",
            "--yes",
        ],
        capture_output=True,
        text=True,
        check=True,
        env=os.environ.copy(),
    )

    assert not install_dir.exists()
    assert not (bin_dir / "ds2api").exists()
