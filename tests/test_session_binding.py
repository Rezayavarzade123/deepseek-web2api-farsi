"""Regression tests for account-bound, caller-scoped upstream sessions."""
from __future__ import annotations

import server
from session_cache import SessionCache


class _Adapter:
    def __init__(self, name: str):
        self.name = name

    def create_session(self) -> str:
        return f"session-created-by-{self.name}"


class _Account:
    def __init__(self, name: str):
        self.id = name
        self.adapter = _Adapter(name)


def test_cached_session_never_crosses_accounts(monkeypatch):
    monkeypatch.setattr(server, "SESSION_CACHE", SessionCache(ttl=60))
    key = "nonstream:conversation"

    first = server.AcquiredAccount(_Account("account-a"), cache_key=key)
    assert first.create_session() == "session-created-by-account-a"
    first.record_message_id(42, full_prompt="User: hello")

    second = server.AcquiredAccount(_Account("account-b"), cache_key=key)
    # Account B must create a fresh session rather than sending account A's
    # session ID and parent chain with B's credentials.
    assert second.create_session() == "session-created-by-account-b"
    assert second.parent_message_id is None


def test_cached_session_is_reused_by_its_own_account(monkeypatch):
    monkeypatch.setattr(server, "SESSION_CACHE", SessionCache(ttl=60))
    key = "nonstream:conversation"
    account = _Account("account-a")

    first = server.AcquiredAccount(account, cache_key=key)
    first.create_session()
    first.record_message_id(42, full_prompt="User: hello")

    second = server.AcquiredAccount(account, cache_key=key)
    assert second.create_session() == "session-created-by-account-a"
    assert second.parent_message_id == 42


def test_openai_user_is_preserved_and_required_for_cache():
    req = server.ChatCompletionRequest.model_validate({
        "model": "deepseek-flash",
        "messages": [{"role": "user", "content": "hello"}],
        "user": "alice",
    })
    request = type("Request", (), {"headers": {}})()
    assert server._extract_openai_user(req, request) == "user:alice"

    anonymous = server.ChatCompletionRequest.model_validate({
        "messages": [{"role": "user", "content": "hello"}],
    })
    assert server._extract_openai_user(anonymous, request) is None


def test_cache_keys_are_isolated_between_api_keys():
    request_a = type("Request", (), {
        "headers": {"Authorization": "Bearer api-key-a"},
    })()
    request_b = type("Request", (), {
        "headers": {"Authorization": "Bearer api-key-b"},
    })()
    assert server._cache_key(request_a, "nonstream", "user:alice") != \
        server._cache_key(request_b, "nonstream", "user:alice")


def test_acquire_prefers_the_account_bound_to_cached_session(monkeypatch):
    class _Pool:
        def __init__(self):
            self.preferred = None
            self.released = None

        def acquire_by_id(self, account_id):
            self.preferred = account_id
            return _Account(account_id)

        def acquire(self):
            raise AssertionError("should not round-robin a cached conversation")

        def release(self, account):
            self.released = account.id

    cache = SessionCache(ttl=60)
    cache.put("key", server.ChatSession("session-a", account_id="account-a"))
    pool = _Pool()
    monkeypatch.setattr(server, "SESSION_CACHE", cache)
    monkeypatch.setattr(server, "pool", pool)

    acquired = server._acquire("key")
    try:
        assert acquired.acct.id == "account-a"
        assert pool.preferred == "account-a"
    finally:
        acquired.release()
    assert pool.released == "account-a"
