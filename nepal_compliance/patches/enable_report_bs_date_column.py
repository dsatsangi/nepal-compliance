import frappe


def execute():
    # Check field defaults don't apply to an already saved Single, so turn the
    # report BS date column on explicitly for existing sites.
    frappe.db.set_single_value("Nepal Compliance Settings", "add_bs_date_column_in_reports", 1)
