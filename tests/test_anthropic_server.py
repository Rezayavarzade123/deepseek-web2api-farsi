"""Regression tests for Anthropic error mapping and response model IDs."""
from __future__ import annotations

import asyncio
import json

import pytest
from fastapi import HTTPException

import server
from adapter import RateLimitError, UpstreamEmptyError


class _Account:
    id = "test-account"


class _Acquired:
    acct = _Account()
    parent_message_id = None

    def __init__(self, error):
        self.adapter = self
        self.error = error
        self.released = False

    def prepare_prompt(self, prompt):
        return prompt

    def create_session(self):
        return "session"

    def chat(self, *args, **kwargs):
        raise self.error

    def release(self):
        self.released = True


@pytest.mark.parametrize(
    ("error", "status_code"),
    [
        (RateLimitError("too frequent"), 429),
        (UpstreamEmptyError("empty"), 502),
    ],
)
def test_anthropic_nonstream_maps_upstream_errors(monkeypatch, error, status_code):
    acquired = _Acquired(error)
    monkeypatch.setattr(server, "_acquire", lambda cache_key=None: acquired)

    with pytest.raises(HTTPException) as exc_info:
        server._anthropic_nonstream(
            "msg_test", "User: hello", [], cache_key="nonstream:test"
        )

    assert exc_info.value.status_code == status_code
    assert acquired.released is True


def test_anthropic_nonstream_marks_protocol_hint_as_bad_gateway(monkeypatch):
    from adapter import UpstreamHintError

    acquired = _Acquired(UpstreamHintError("upstream hint"))
    marked = []
    monkeypatch.setattr(server, "_acquire", lambda cache_key=None: acquired)
    monkeypatch.setattr(
        server.pool,
        "mark_error",
        lambda account, message: marked.append((account, message)),
    )

    with pytest.raises(HTTPException) as exc_info:
        server._anthropic_nonstream(
            "msg_test", "User: hello", [], cache_key="nonstream:test"
        )

    assert exc_info.value.status_code == 502
    assert marked == [(acquired.acct, "upstream hint")]
    assert acquired.released is True


class _SuccessfulAcquired:
    acct = _Account()
    parent_message_id = None

    def __init__(self):
        self.adapter = self
        self.released = False

    def prepare_prompt(self, prompt):
        return prompt

    def create_session(self):
        return "session"

    def chat(self, *args, **kwargs):
        return "Hello from the upstream", ""

    def chat_stream(self, *args, **kwargs):
        yield "Hello from the upstream"

    def release(self):
        self.released = True


def test_openai_responses_echo_the_requested_model_alias():
    chunk = server._openai_chunk("chatcmpl_test", model="deepseek-v4-pro")
    payload = json.loads(chunk.removeprefix("data: ").strip())
    assert payload["model"] == "deepseek-v4-pro"


def test_openai_tool_call_chunks_echo_the_requested_model_alias():
    chunks = server._emit_tool_calls_chunks(
        [{
            "id": "call_test",
            "function": {"name": "lookup", "arguments": '{"query":"example"}'},
        }],
        "chatcmpl_test",
        model="deepseek-v4-pro",
    )

    models = [
        json.loads(chunk.removeprefix("data: ").strip())["model"]
        for chunk in chunks
    ]
    assert models == ["deepseek-v4-pro"] * len(chunks)


def test_openai_nonstream_response_echoes_the_requested_model_alias(monkeypatch):
    acquired = _SuccessfulAcquired()
    monkeypatch.setattr(server, "_acquire", lambda cache_key=None: acquired)

    response = server._handle_nonstream(
        "chatcmpl_test", "User: hello", response_model="deepseek-v4-pro"
    )

    assert response["model"] == "deepseek-v4-pro"
    assert acquired.released is True


def test_anthropic_nonstream_response_echoes_the_requested_model_alias(monkeypatch):
    acquired = _SuccessfulAcquired()
    monkeypatch.setattr(server, "_acquire", lambda cache_key=None: acquired)

    response = server._anthropic_nonstream(
        "msg_test", "User: hello", [], response_model="deepseek-v4-pro"
    )

    assert response["model"] == "deepseek-v4-pro"
    assert acquired.released is True


def test_openai_stream_chunks_echo_the_requested_model_alias(monkeypatch):
    acquired = _SuccessfulAcquired()
    monkeypatch.setattr(server, "_acquire", lambda cache_key=None: acquired)

    async def collect():
        response = await server._handle_stream(
            "chatcmpl_test", "User: hello", response_model="deepseek-v4-pro"
        )
        chunks = []
        async for chunk in response.body_iterator:
            chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
        return "".join(chunks)

    body = asyncio.run(collect())
    data = [line[6:] for line in body.splitlines() if line.startswith("data: ")]
    model_ids = [json.loads(item)["model"] for item in data if item != "[DONE]"]

    assert model_ids
    assert set(model_ids) == {"deepseek-v4-pro"}
    assert acquired.released is True


def test_anthropic_stream_message_echoes_the_requested_model_alias(monkeypatch):
    acquired = _SuccessfulAcquired()
    monkeypatch.setattr(server, "_acquire", lambda cache_key=None: acquired)

    async def collect():
        response = await server._anthropic_stream(
            "msg_test", "User: hello", [], response_model="deepseek-v4-pro"
        )
        events = []
        async for event in response.body_iterator:
            events.append(event.decode() if isinstance(event, bytes) else event)
        return "".join(events)

    body = asyncio.run(collect())
    message_start = next(
        line[6:]
        for line in body.splitlines()
        if line.startswith("data: ") and '"type": "message_start"' in line
    )

    assert json.loads(message_start)["message"]["model"] == "deepseek-v4-pro"
    assert acquired.released is True
