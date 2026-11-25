# Copyright (c) 2025, Yarsa Labs Pvt. Ltd. and contributors
# For license information, please see LICENSE at the root of this repository

import frappe
from frappe import _
from frappe.model.document import Document


class CBMSSettings(Document):
	def validate(self):
		seen = set()
		for row in self.credentials:
			if row.company in seen:
				frappe.throw(
					_("Row #{0}: Company {1} is added more than once.").format(row.idx, frappe.bold(row.company))
				)
			seen.add(row.company)

			country = frappe.db.get_value("Company", row.company, "country")
			if country != "Nepal":
				frappe.throw(
					_("Row #{0}: Company {1} must be based in Nepal.").format(row.idx, frappe.bold(row.company))
				)

			pan = (row.panvat_no or "").strip()
			if not pan.isdigit():
				frappe.throw(_("Row #{0}: PAN/VAT No. must be numeric.").format(row.idx))
			row.panvat_no = pan
