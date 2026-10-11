"""Text-only input validation for the private web-chat adapter."""

import pytest
from fastapi import HTTPException

from anthropic_format import AnthropicRequest, AnthropicMessage, ContentBlock
from server import ChatMessage, ContentPart, _validate_anthropic_text_only, _validate_openai_text_only


def test_openai_text_parts_are_accepted():
    _validate_openai_text_only([
        ChatMessage(role="user", content=[ContentPart(type="text", text="hello")])
    ])


def test_openai_image_parts_are_rejected_instead_of_silently_dropped():
    with pytest.raises(HTTPException) as exc:
        _validate_openai_text_only([
            ChatMessage(role="user", content=[ContentPart(type="image_url")])
        ])
    assert exc.value.status_code == 400
    assert "text-only proxy" in exc.value.detail


def test_anthropic_image_message_is_rejected():
    request = AnthropicRequest(
        messages=[AnthropicMessage(role="user", content=[ContentBlock(type="image")])]
    )
    with pytest.raises(HTTPException) as exc:
        _validate_anthropic_text_only(request)
    assert exc.value.status_code == 400
    assert "image input" in exc.value.detail


def test_anthropic_image_in_system_content_is_rejected():
    request = AnthropicRequest(
        messages=[AnthropicMessage(role="user", content="Describe this image")],
        system=[ContentBlock(type="image")],
    )
    with pytest.raises(HTTPException) as exc:
        _validate_anthropic_text_only(request)
    assert exc.value.status_code == 400
