#!/usr/bin/env python3
"""Ensure admin_settings.php always loads the Vite helper and emits diagnostics after the bundle."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "sections" / "admin_settings.php"

def ensure_guard(text: str) -> tuple[str, bool]:
    comment = "// Ensure Vite helper is available even when this template is rendered via admin_router.php\n"
    desired_block = (
        "if (!function_exists('vite')) {\n"
        "    require_once dirname(__DIR__) . '/includes/vite_helper.php';\n"
        "}\n\n"
    )

    if comment not in text:
        raise RuntimeError("Unable to locate Vite helper comment in admin_settings.php")

    before, after = text.split(comment, 1)
    anchor = "// Always include admin navbar on settings page, even when accessed directly\n"
    if anchor not in after:
        raise RuntimeError("Unable to locate admin navbar anchor in admin_settings.php")

    current_block, tail = after.split(anchor, 1)
    if current_block == desired_block:
        return text, False

    new_text = before + comment + desired_block + anchor + tail
    return new_text, True

def add_diagnostics(text: str) -> tuple[str, bool]:
    pattern = re.compile(
        r"(^[ \t]*echo vite\('js/admin-settings\.js'\);)(?!\s*echo \"<!-- \[Diagnostics\] emitted admin-settings bundle --><\\n\";)",
        re.MULTILINE,
    )

    changed = False

    def repl(match: re.Match[str]) -> str:
        nonlocal changed
        changed = True
        indent = match.group(1).split("e", 1)[0]
        # Preserve exact leading whitespace from the matched line
        leading_ws = match.group(1)[:-len(match.group(1).lstrip())]
        diag_line = (
            f"\n{leading_ws}echo \"<!-- [Diagnostics] emitted admin-settings bundle -->\\n\";"
        )
        return match.group(1) + diag_line

    new_text = pattern.sub(repl, text)
    return new_text, changed

def main() -> None:
    if not TARGET.exists():
        raise SystemExit(f"Target file not found: {TARGET}")

    original = TARGET.read_text()
    updated, guard_changed = ensure_guard(original)
    updated, diag_changed = add_diagnostics(updated)

    if not guard_changed and not diag_changed:
        print("No changes needed; admin_settings.php already up to date.")
        return

    TARGET.write_text(updated)
    print(
        "Applied updates:" ,
        "guard fixed" if guard_changed else "guard ok",
        ";",
        "diagnostics added" if diag_changed else "diagnostics ok",
    )

if __name__ == "__main__":
    main()
