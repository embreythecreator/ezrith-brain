"""Tests for the Nous-ezrith-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"ezrith"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``ezrith-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "ezrith" tag namespace.

``is_nous_ezrith_non_agentic`` should only match the actual Ezrith
ezrith-3 / Ezrith-4 chat family.
"""

from __future__ import annotations

import pytest

from ezrith_cli.model_switch import (
    _EZRITH_MODEL_WARNING,
    _check_ezrith_model_warning,
    is_nous_ezrith_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "embreythecreator/ezrith-3-Llama-3.1-70B",
        "embreythecreator/ezrith-3-Llama-3.1-405B",
        "ezrith-3",
        "ezrith-3",
        "ezrith-4",
        "ezrith-4-405b",
        "ezrith_4_70b",
        "openrouter/ezrith3:70b",
        "openrouter/embreythecreator/ezrith-4-405b",
        "embreythecreator/ezrith3",
        "ezrith-3.1",
    ],
)
def test_matches_real_nous_ezrith_chat_models(model_name: str) -> None:
    assert is_nous_ezrith_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as Nous Ezrith 3/4"
    )
    assert _check_ezrith_model_warning(model_name) == _EZRITH_MODEL_WARNING


