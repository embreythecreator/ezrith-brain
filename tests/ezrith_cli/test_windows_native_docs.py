from pathlib import Path


def test_windows_native_install_path_docs_match_installer() -> None:
    doc = Path("website/docs/user-guide/windows-native.md").read_text()
    install = Path("scripts/install.ps1").read_text()

    # The launchers live in the managed binary dir OUTSIDE the git checkout
    # (EZRITH_HOME\bin, next to the managed uv) — NOT the whole venv\Scripts
    # (which would shadow the user's python, #83797) and NOT a dir inside
    # the checkout (which `ezrith update`'s autostash swept off disk).
    assert "%LOCALAPPDATA%\\ezrith\\bin" in doc
    assert (
        "Get-Command ezrith        # should print "
        "C:\\Users\\<you>\\AppData\\Local\\ezrith\\bin\\ezrith.exe"
    ) in doc
    # Installer exposes $EzrithHome\bin, and must copy the launchers into it.
    assert '$ezrithBin = "$EzrithHome\\bin"' in install
    assert "ezrith.exe" in install and "ezrith-acp.exe" in install
    # Guard against regressions to either legacy layout.
    assert '$ezrithBin = "$InstallDir\\venv\\Scripts"' not in install
    assert '$ezrithBin = "$InstallDir\\bin"' not in install
