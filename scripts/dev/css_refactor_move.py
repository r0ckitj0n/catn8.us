#!/usr/bin/env python3
"""Move CSS files into the new architecture without git dependencies."""

import logging
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAPPING = [
    ('src/styles/theme.css', 'src/styles/foundation/tokens.css'),
    ('src/styles/dev-status.css', 'src/styles/foundation/dev-status.css'),
    ('src/styles/base/z-index.css', 'src/styles/foundation/z-index.css'),
    ('src/styles/base/typography.css', 'src/styles/foundation/typography.css'),
    ('src/styles/site-base.css', 'src/styles/layouts/site-base.css'),
    ('src/styles/room-main.css', 'src/styles/layouts/room-main.css'),
    ('src/styles/room-page.css', 'src/styles/layouts/room-page.css'),
    ('src/styles/embed-iframe.css', 'src/styles/layouts/embed-iframe.css'),
    ('src/styles/utilities-ui.css', 'src/styles/utilities/utilities-ui.css'),
    ('src/styles/cart-modal.css', 'src/styles/components/cart-modal.css'),
    ('src/styles/cart-system.css', 'src/styles/components/cart-system.css'),
    ('src/styles/login-modal.css', 'src/styles/components/login-modal.css'),
    ('src/styles/payment-modal.css', 'src/styles/components/payment-modal.css'),
    ('src/styles/sales-system.css', 'src/styles/components/sales-system.css'),
    ('src/styles/help-documentation.css', 'src/styles/pages/admin/help-documentation.css'),
    ('src/styles/admin-dashboard.css', 'src/styles/pages/admin/admin-dashboard.css'),
    ('src/styles/admin-db-status.css', 'src/styles/pages/admin/admin-db-status.css'),
    ('src/styles/admin-help-bubble.css', 'src/styles/pages/admin/admin-help-bubble.css'),
    ('src/styles/admin-hints.css', 'src/styles/pages/admin/admin-hints.css'),
    ('src/styles/admin-marketing.css', 'src/styles/pages/admin/admin-marketing.css'),
    ('src/styles/admin-nav.css', 'src/styles/pages/admin/admin-nav.css'),
    ('src/styles/admin-notifications.css', 'src/styles/pages/admin/admin-notifications.css'),
    ('src/styles/admin-pos.css', 'src/styles/pages/admin/admin-pos.css'),
    ('src/styles/admin-room-map-editor.css', 'src/styles/pages/admin/admin-room-map-editor.css'),
    ('src/styles/sections/admin-settings.css', 'src/styles/pages/admin/admin-settings.css'),
    ('src/styles/sections/admin-settings-extras.css', 'src/styles/pages/admin/admin-settings-extras.css'),
    ('src/styles/sections/admin-db-tools.css', 'src/styles/pages/admin/admin-db-tools.css'),
    ('src/styles/sections/admin-inventory.css', 'src/styles/pages/admin/admin-inventory.css'),
    ('src/styles/admin/email-settings.css', 'src/styles/pages/admin/email-settings.css'),
    ('src/styles/admin/admin-legacy-modals.css', 'src/styles/legacy/admin-legacy-modals.css'),
    ('src/styles/variables.css', 'src/styles/legacy/variables.css'),
]

def move_file(src: Path, dst: Path) -> None:
    if not src.exists():
        logging.warning(f'[skip] missing {src.relative_to(ROOT)}')
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        logging.warning(f'[skip] destination already exists {dst.relative_to(ROOT)}')
        return
    shutil.move(str(src), str(dst))
    logging.info(f'[moved] {src.relative_to(ROOT)} -> {dst.relative_to(ROOT)}')


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    for src_rel, dst_rel in MAPPING:
        move_file(ROOT / src_rel, ROOT / dst_rel)
