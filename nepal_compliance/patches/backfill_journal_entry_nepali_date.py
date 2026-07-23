import frappe
from nepal_compliance.nepali_date_utils.utils import bs_date, nepal_compliance_enabled


def execute():
    if not nepal_compliance_enabled():
        frappe.logger().info(
            "Nepal Compliance: skipping Journal Entry nepali_date backfill, feature disabled."
        )
        return

    records = frappe.db.sql(
        """
        SELECT name, posting_date
        FROM `tabJournal Entry`
        WHERE posting_date IS NOT NULL
          AND (nepali_date IS NULL OR nepali_date = '')
        """,
        as_dict=True,
    )

    if not records:
        return

    for i, row in enumerate(records):
        bs = bs_date(row.posting_date)
        if bs and str(bs).strip() != str(row.posting_date).strip():
            frappe.db.set_value(
                "Journal Entry", row.name, "nepali_date", str(bs).strip(), update_modified=False
            )

        if i % 200 == 0:
            frappe.db.commit()

    frappe.db.commit()
