from functools import wraps
from inspect import signature

import frappe.utils
import frappe.utils.html_utils


def _supports_disallowed_tags(function):
    try:
        parameters = signature(function).parameters
    except (TypeError, ValueError):
        return False

    return "disallowed_tags" in parameters


def _patch_function(function):
    if getattr(function, "_nepal_compliance_sanitize_html_patch", False):
        return function

    supports_disallowed_tags = _supports_disallowed_tags(function)

    @wraps(function)
    def patched_sanitize_html(*args, **kwargs):
        if not supports_disallowed_tags:
            kwargs.pop("disallowed_tags", None)

        return function(*args, **kwargs)

    patched_sanitize_html._nepal_compliance_sanitize_html_patch = True
    return patched_sanitize_html


def apply():
    frappe.utils.sanitize_html = _patch_function(frappe.utils.sanitize_html)
    frappe.utils.html_utils.sanitize_html = _patch_function(frappe.utils.html_utils.sanitize_html)


apply()
