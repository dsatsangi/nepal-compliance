import frappe.utils

# Keep original reference
_original_sanitize_html = frappe.utils.sanitize_html


def patched_sanitize_html(*args, **kwargs):
    # Remove unsupported kwarg safely
    kwargs.pop("disallowed_tags", None)

    return _original_sanitize_html(*args, **kwargs)


# Apply monkey patch
frappe.utils.sanitize_html = patched_sanitize_html