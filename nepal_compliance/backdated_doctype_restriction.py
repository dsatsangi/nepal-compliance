import frappe
from frappe.utils import getdate, nowdate
from frappe import _


EXCLUDED_DOCTYPES = {
    "Comment",
    "File",
    "Version",
    "Activity Log",
    "View Log",
    "Error Log",
    "Repost Item Valuation",
    "Scheduled Job Log",
}


def validate_backdate_and_sequence(doc, method):

    # ---------------------------------------------------
    # Skip framework/internal doctypes
    # ---------------------------------------------------
    if doc.doctype in EXCLUDED_DOCTYPES:
        return

    # ---------------------------------------------------
    # Skip if required fields don't exist
    # ---------------------------------------------------
    if not hasattr(doc, "posting_date"):
        return

    if not hasattr(doc, "company"):
        return

    # ---------------------------------------------------
    # Skip during patches/migrations/install
    # ---------------------------------------------------
    if frappe.flags.in_patch:
        return

    if frappe.flags.in_install:
        return

    if frappe.flags.in_migrate:
        return

    # ---------------------------------------------------
    # Ensure settings exist
    # ---------------------------------------------------
    if not frappe.db.exists("Nepal Compliance Settings"):
        return

    try:
        settings = frappe.get_single("Nepal Compliance Settings")
    except Exception:
        return

    # ---------------------------------------------------
    # Restrict only configured doctypes
    # ---------------------------------------------------
    allowed_doctypes = [
        d.doctypes for d in settings.restricted_doctypes
    ]

    if doc.doctype not in allowed_doctypes:
        return

    # ---------------------------------------------------
    # Role override check
    # ---------------------------------------------------
    user_roles = frappe.get_roles(frappe.session.user)

    override_roles = [
        r.role for r in settings.allowed_role
    ]

    can_override = bool(
        set(user_roles).intersection(override_roles)
    )

    # ---------------------------------------------------
    # Backdate validation
    # ---------------------------------------------------
    max_days = settings.max_backdate_days_allowed or 0

    if max_days > 0:

        today = getdate(nowdate())
        posting_date = getdate(doc.posting_date)

        delta_days = (today - posting_date).days

        if delta_days > max_days and not can_override:

            frappe.throw(_(
                f"Back-dated entries are only allowed within "
                f"{max_days} day(s). "
                f"This {doc.doctype} is {delta_days} day(s) old."
            ))

    # ---------------------------------------------------
    # Out-of-sequence validation
    # ---------------------------------------------------
    if (
        settings.prevent_out_of_sequence_doctype_submission
        and not can_override
    ):

        future_doc_exists = frappe.db.exists(
            doc.doctype,
            {
                "docstatus": 1,
                "posting_date": [">", doc.posting_date],
                "company": doc.company
            }
        )

        if future_doc_exists:

            frappe.throw(_(
                f"You cannot submit this {doc.doctype} because "
                f"a newer document has already been submitted "
                f"with a later posting date. "
                f"Please adjust the date or contact an "
                f"authorized approver."
            ))