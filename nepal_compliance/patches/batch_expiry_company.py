"""Company filter for the stock "Batch Item Expiry Status" report.

The standard report has no company filter and Batch has no company field, so the
session company never applied. When a company is passed, restrict batches to
those held in that company's warehouses and report the quantity held there.
"""

import frappe
from frappe.utils import flt

REPORT_MODULE = "erpnext.stock.report.batch_item_expiry_status.batch_item_expiry_status"


def _company_batch_qty(batch_nos, company):
    qty = {}
    if not batch_nos:
        return qty

    warehouses = frappe.get_all("Warehouse", filters={"company": company}, pluck="name")
    if not warehouses:
        return qty

    module = frappe.get_module(REPORT_MODULE)
    for batch_no, value in module.get_batch_qty_in_warehouses(batch_nos, warehouses).items():
        qty[batch_no] = flt(value)
    return qty


def apply():
    module = frappe.get_module(REPORT_MODULE)
    if getattr(module, "_nc_company_patched", False):
        return

    original = module.get_batch_details

    def get_batch_details(filters):
        batches = original(filters)
        company = (filters or {}).get("company")
        if not company:
            return batches

        qty = _company_batch_qty([b.name for b in batches], company)
        result = []
        for batch in batches:
            batch.batch_qty = qty.get(batch.name, 0.0)
            if flt(batch.batch_qty) > 0:
                result.append(batch)
        return result

    module.get_batch_details = get_batch_details
    module._nc_company_patched = True
