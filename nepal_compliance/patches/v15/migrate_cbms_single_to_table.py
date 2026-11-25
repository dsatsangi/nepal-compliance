import frappe


def execute():
    """Move the legacy single-company CBMS config into the per-company table."""
    frappe.reload_doc("nepal_compliance", "doctype", "cbms_company_credentials")
    frappe.reload_doc("nepal_compliance", "doctype", "cbms_settings")

    old = frappe.db.sql(
        """select field, value from `tabSingles`
        where doctype = 'CBMS Settings'
        and field in ('user_name', 'panvat_no', 'configure_cbms', 'sales_api_url', 'credit_note_api_url')"""
    )
    old = dict(old)
    if not old.get("user_name") or not old.get("panvat_no"):
        return

    from frappe.utils.password import get_decrypted_password

    password = get_decrypted_password("CBMS Settings", "CBMS Settings", "password", raise_exception=False)

    company = frappe.defaults.get_global_default("company") or frappe.db.get_value("Company", {}, "name")
    if not company:
        return

    settings = frappe.get_doc("CBMS Settings")
    if any(r.company == company for r in settings.credentials):
        return

    settings.append("credentials", {
        "company": company,
        "enabled": int(old.get("configure_cbms") or 0),
        "user_name": old["user_name"],
        "password": password,
        "panvat_no": old["panvat_no"],
        "sales_api_url": old.get("sales_api_url") or "https://cbapi.ird.gov.np/api/bill",
        "credit_note_api_url": old.get("credit_note_api_url") or "https://cbapi.ird.gov.np/api/billreturn",
    })
    settings.flags.ignore_mandatory = True
    settings.save(ignore_permissions=True)
