"""Resolve EZRITH_HOME for standalone skill scripts.

Skill scripts may run outside the Ezrith process (system Python, nix env,
CI) where ``ezrith_constants`` is not importable.  This module provides the
same ``get_ezrith_home()`` contract without requiring it on ``sys.path``.

When ``ezrith_constants`` IS available it is used directly so profile
resolution and any future enhancements are picked up automatically.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from ezrith_constants import get_ezrith_home as get_ezrith_home
except (ModuleNotFoundError, ImportError):

    def get_ezrith_home() -> Path:
        """Return the Ezrith home directory (default: ``~/.ezrith``)."""
        val = os.environ.get("EZRITH_HOME", "").strip()
        return Path(val) if val else Path.home() / ".ezrith"
