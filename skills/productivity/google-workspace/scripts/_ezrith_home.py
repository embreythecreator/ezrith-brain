"""Resolve EZRITH_HOME for standalone skill scripts.

Skill scripts may run outside the Ezrith process (e.g. system Python,
nix env, CI) where ``ezrith_constants`` is not importable.  This module
provides the same ``get_ezrith_home()`` and ``display_ezrith_home()``
contracts as ``ezrith_constants`` without requiring it on ``sys.path``.

When ``ezrith_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``ezrith_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``EZRITH_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from ezrith_constants import display_ezrith_home as display_ezrith_home
    from ezrith_constants import get_ezrith_home as get_ezrith_home
except (ModuleNotFoundError, ImportError):

    def get_ezrith_home() -> Path:
        """Return the Ezrith home directory (default: ~/.ezrith).

        Mirrors ``ezrith_constants.get_ezrith_home()``."""
        val = os.environ.get("EZRITH_HOME", "").strip()
        return Path(val) if val else Path.home() / ".ezrith"

    def display_ezrith_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``ezrith_constants.display_ezrith_home()``."""
        home = get_ezrith_home()
        try:
            return "~/" + home.relative_to(Path.home()).as_posix()
        except ValueError:
            return str(home)
