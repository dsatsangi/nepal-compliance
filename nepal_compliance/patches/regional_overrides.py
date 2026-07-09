"""Monkey patches for ERPNext regional behaviors."""

from __future__ import annotations

from typing import Callable

import erpnext.regional

from nepal_compliance.utils import is_restriction_enabled

_DOC_TO_SETTING = {
    "Sales Invoice": "restrict_sales_invoice_cancellation",
    "Purchase Invoice": "restrict_purchase_invoice_deletion",
    "Payment Entry": "restrict_payment_entry_deletion",
}


def _patch_check_deletion_permission() -> None:
    """Wrap the ERPNext regional deletion check to honor compliance settings."""
    original: Callable = erpnext.regional.check_deletion_permission

    def patched(doc, method):
        setting = _DOC_TO_SETTING.get(doc.doctype)
        if setting and not is_restriction_enabled(setting):
            return
        original(doc, method)

    if getattr(erpnext.regional, "_nc_patched_check_deletion", False):
        return

    erpnext.regional.check_deletion_permission = patched
    erpnext.regional._nc_patched_check_deletion = True


_patch_check_deletion_permission()
