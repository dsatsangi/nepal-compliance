import frappe
from frappe import _
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice
from nepal_compliance.utils import is_restriction_enabled

class CustomSalesInvoice(SalesInvoice):
    def on_cancel(self):
        if is_restriction_enabled("restrict_sales_invoice_cancellation"):
            frappe.throw(_(f"You cannot cancel {self.name}. Please create a Return / Credit Note instead."))
        super().on_cancel()
