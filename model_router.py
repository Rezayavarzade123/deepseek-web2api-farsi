"""
Model router — maps a client-supplied ``model`` field to a private web-chat
``model_type`` hint and optional per-model thinking/search overrides.

Example configuration::

  MODEL_ROUTES='{"deepseek-flash":"default"}'

A route value may be ``"default"``, ``"expert"``, or an object such as
``{"model_type":"expert","thinking":"auto","search":"enabled"}``.
These are proxy-side hints for an undocumented web protocol, not official
DeepSeek API model IDs. The upstream's current V4.1 experience combines
capabilities that were previously exposed as separate modes; whether these
legacy mode hints are still honored requires live verification.

Resolution priority (highest first):
  1. An exact client ``model`` field that matches the routing table.
  2. ``MODE`` / ``THINKING`` / ``SEARCH`` environment fallbacks.
  3. Per-request ``thinking_mode`` / ``search_enabled`` fields when the
     corresponding environment settings are ``auto``.

The router never raises on a missing model; it falls through to environment
and request settings.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Optional

from logger import get_logger

log = get_logger("model_router")


@dataclass
class RouteDecision:
    model_type: str = "default"            # "default" | "expert"
    thinking: Optional[bool] = None        # True/False override; None = respect env/client
    search: Optional[bool] = None
    matched_model: Optional[str] = None    # the public model that matched, if any


@dataclass
class _Route:
    model_type: str = "default"
    thinking: Optional[bool] = None
    search: Optional[bool] = None


class ModelRouter:
    def __init__(self, raw: str | None = None):
        self._routes: dict[str, _Route] = {}
        self._raw = raw if raw is not None else os.environ.get("MODEL_ROUTES", "")
        if self._raw:
            self._parse(self._raw)

    def _parse(self, raw: str) -> None:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            log.warning("model_routes_parse_failed", extra={"error": str(e), "raw": raw[:200]})
            return
        if not isinstance(data, dict):
            log.warning("model_routes_not_object", extra={"type": type(data).__name__})
            return
        for name, spec in data.items():
            try:
                self._routes[str(name)] = self._route_from_spec(spec)
            except Exception as e:  # noqa: BLE001
                log.warning("model_route_invalid", extra={"model": name, "error": str(e)})

    @staticmethod
    def _route_from_spec(spec) -> _Route:
        if isinstance(spec, str):
            if spec not in {"default", "expert"}:
                raise ValueError(f"unknown model_type shorthand: {spec!r}")
            return _Route(model_type=spec)
        if isinstance(spec, dict):
            mt = str(spec.get("model_type", "default"))
            if mt not in {"default", "expert"}:
                raise ValueError(f"unknown model_type: {mt!r}")
            think_raw = spec.get("thinking")
            search_raw = spec.get("search")
            think = ModelRouter._coerce_bool(think_raw)
            search = ModelRouter._coerce_bool(search_raw)
            return _Route(model_type=mt, thinking=think, search=search)
        raise ValueError(f"unsupported route spec type: {type(spec).__name__}")

    @staticmethod
    def _coerce_bool(value) -> Optional[bool]:
        if value is None:
            return None
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            v = value.strip().lower()
            if v in {"1", "true", "yes", "on", "enabled"}:
                return True
            if v in {"0", "false", "no", "off", "disabled"}:
                return False
        return None

    @property
    def models(self) -> list[str]:
        return list(self._routes.keys())

    def route_for(self, model: Optional[str]) -> RouteDecision:
        """Return a route decision for the given client ``model`` field.

        If the model is not in the routing table, returns a default decision
        (model_type="default", no overrides) — the caller then applies
        MODE / THINKING / SEARCH env-var logic as before.
        """
        if not model:
            return RouteDecision()
        route = self._routes.get(model)
        if route is None:
            return RouteDecision()
        return RouteDecision(
            model_type=route.model_type,
            thinking=route.thinking,
            search=route.search,
            matched_model=model,
        )
