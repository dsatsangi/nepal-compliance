import frappe
from erpnext.buying.doctype.supplier.supplier_overview import get_supplier_companies as _get_supplier_companies
from erpnext.selling.doctype.customer.customer_overview import get_customer_companies as _get_customer_companies


def _with_session_company(companies):
    """ERPNext lists only companies a party has transacted with, so a session company
    without activity can never be selected and the Overview tab silently falls back to
    another company. Always offer the session company when session defaults are enforced."""
    if not frappe.db.get_single_value("Nepal Compliance Settings", "enforce_session_defaults"):
        return companies

    company = frappe.defaults.get_user_default("company") or frappe.defaults.get_user_default("Company")
    if company and company not in companies and frappe.db.exists("Company", company):
        return sorted([*companies, company])
    return companies


@frappe.whitelist()
def get_customer_companies(customer: str):
    return _with_session_company(_get_customer_companies(customer))


@frappe.whitelist()
def get_supplier_companies(supplier: str):
    return _with_session_company(_get_supplier_companies(supplier))
