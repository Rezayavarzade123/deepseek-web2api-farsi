"""Unit tests for model_router."""
import json
import os

import pytest

from model_router import ModelRouter


def test_empty_routes():
    r = ModelRouter("{}")
    assert r.models == []
    d = r.route_for("anything")
    assert d.matched_model is None
    assert d.model_type == "default"


def test_simple_string_route():
    r = ModelRouter(json.dumps({"deepseek-flash": "default", "deepseek-v4-pro": "expert"}))
    d = r.route_for("deepseek-v4-pro")
    assert d.matched_model == "deepseek-v4-pro"
    assert d.model_type == "expert"
    d = r.route_for("deepseek-flash")
    assert d.model_type == "default"


def test_dict_route_with_thinking_and_search():
    raw = json.dumps({
        "deepseek-v4-pro": {
            "model_type": "expert",
            "thinking": "enabled",
            "search": "disabled",
        }
    })
    r = ModelRouter(raw)
    d = r.route_for("deepseek-v4-pro")
    assert d.thinking is True
    assert d.search is False


def test_unknown_model_returns_default_decision():
    r = ModelRouter(json.dumps({"foo": "expert"}))
    d = r.route_for("bar")
    assert d.matched_model is None
    assert d.model_type == "default"


def test_invalid_json_is_ignored():
    r = ModelRouter("not-json")
    assert r.models == []


def test_invalid_route_value_ignored():
    raw = json.dumps({"foo": "unknown-mode", "bar": "default"})
    r = ModelRouter(raw)
    assert r.models == ["bar"]


def test_optional_fields_default_to_none():
    r = ModelRouter(json.dumps({"foo": "expert"}))
    d = r.route_for("foo")
    assert d.thinking is None
    assert d.search is None
