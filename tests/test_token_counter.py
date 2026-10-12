"""Unit tests for token_counter."""
import pytest

from token_counter import count_text, count_prompt, _is_cjk, _char_estimate


def test_count_text_empty():
    assert count_text("") == 0
    assert count_text(None) == 0


def test_count_text_ascii():
    n = count_text("hello world")
    # tiktoken or fallback should return a positive integer.
    assert n > 0
    # Whitespace-only is small but not necessarily 0 — tiktoken counts
    # newlines as separators. We just assert it stays bounded.
    ws = count_text("   \n\t")
    assert ws < 5


def test_count_text_cjk_close_to_char_count():
    cjk_text = "\u4f60\u597d\u4e16\u754c"
    n = count_text(cjk_text)
    # tiktoken cl100k_base merges 4 CJK chars into ~4-6 tokens; the
    # fallback heuristic gives 4. Either way, the count should be in
    # the [3, 8] range.
    assert 3 <= n <= 8


def test_count_text_mixed():
    n = count_text("Hello \u4f60\u597d")
    assert n > 0


def test_count_text_does_not_crash_on_unicode():
    n = count_text("🎉🎊 \u4e2d\u6587 hello")
    assert n >= 1


def test_is_cjk_classifier():
    assert _is_cjk("\u4e2d") is True
    assert _is_cjk("A") is False
    assert _is_cjk(" ") is False


def test_char_estimate_empty():
    assert _char_estimate("") == 0


def test_count_prompt_uses_count_text():
    assert count_prompt("") == 0
    assert count_prompt("abc") == count_text("abc")
