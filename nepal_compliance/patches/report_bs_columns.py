"""Add a BS (Bikram Sambat) column next to every Date/Datetime column of query
and script reports.

Done server-side by wrapping frappe.desk.query_report's result builders, so the
extra columns reach the report view, Excel/CSV export and print/PDF alike.

Controlled by "Add BS Date Column in Reports" in Nepal Compliance Settings
(on by default). Exports always carry the AD date plus the BS column; whether
the BS column is visible on screen is decided client-side (see
public/js/report_bs_columns.bundle.js and VISIBILITY_DEFAULT_KEY).
"""

from functools import wraps

import frappe
import frappe.desk.query_report

from nepal_compliance.nepali_date_utils.nepali_date import format_bs, format_bs_datetime

# per-user "show" / "hide"; unset means hidden for users who already see
# dates in BS (use_ad_date = 0), shown otherwise
VISIBILITY_DEFAULT_KEY = "nc_report_bs_dates"
BS_SUFFIX = "_nc_bs"
DATE_TYPES = ("Date", "Datetime")


def _feature_enabled() -> bool:
    key = "nepal_compliance:report_bs_columns"
    cached = frappe.cache().get_value(key)
    if cached is None:
        try:
            cached = bool(
                frappe.db.get_single_value("Nepal Compliance Settings", "add_bs_date_column_in_reports")
            )
        except Exception:
            cached = False
        frappe.cache().set_value(key, cached, expires_in_sec=300)
    return cached


def _date_format() -> str:
    try:
        return frappe.db.get_single_value("Nepal Compliance Settings", "date_format") or "YYYY-MM-DD"
    except Exception:
        return "YYYY-MM-DD"


def _to_bs(value, fieldtype, fmt):
    if not value:
        return ""
    try:
        if fieldtype == "Datetime":
            return format_bs_datetime(value, f"{fmt} HH:mm:SS")
        return format_bs(value, fmt)
    except Exception:
        # non-date values in date columns, e.g. "Total" or group labels
        return ""


def add_bs_columns(result: dict) -> dict:
    columns = result.get("columns") or []
    if not columns or not result.get("result"):
        return result

    columns = [frappe.desk.query_report.get_column_as_dict(col) for col in columns]
    fieldnames = {col.get("fieldname") for col in columns}
    # report already carries its own BS date, e.g. Sales Invoice nepali_date
    if "nepali_date" in fieldnames:
        return result

    targets = [
        (idx, col)
        for idx, col in enumerate(columns)
        if col.get("fieldtype") in DATE_TYPES
        and col.get("fieldname")
        and not col["fieldname"].endswith(BS_SUFFIX)
        and f"{col['fieldname']}_bs" not in fieldnames
        and f"{col['fieldname']}{BS_SUFFIX}" not in fieldnames
    ]
    if not targets:
        return result

    fmt = _date_format()

    # insert right to left so earlier indexes stay valid for list rows
    for idx, col in reversed(targets):
        fieldname = col["fieldname"]
        bs_fieldname = f"{fieldname}{BS_SUFFIX}"
        columns.insert(
            idx + 1,
            {
                "fieldname": bs_fieldname,
                "label": f"{col.get('label') or fieldname} (BS)",
                "fieldtype": "Data",
                "width": 110,
            },
        )

        for row in result["result"]:
            if isinstance(row, dict):
                row[bs_fieldname] = _to_bs(row.get(fieldname), col["fieldtype"], fmt)
            elif isinstance(row, list) and len(row) > idx:
                row.insert(idx + 1, _to_bs(row[idx], col["fieldtype"], fmt))

    result["columns"] = columns
    # lets patched_make_xlsx keep these AD dates as AD, the BS column covers BS
    frappe.flags.nc_report_bs_columns = True
    return result


def _patch_function(function):
    if getattr(function, "_nepal_compliance_bs_columns_patch", False):
        return function

    @wraps(function)
    def patched(*args, **kwargs):
        result = function(*args, **kwargs)
        if isinstance(result, dict) and _feature_enabled():
            try:
                result = add_bs_columns(result)
            except Exception:
                frappe.log_error(frappe.get_traceback(), "Nepal Compliance report BS columns failed")
        return result

    patched._nepal_compliance_bs_columns_patch = True
    return patched


def apply():
    import frappe.utils.xlsxutils

    query_report = frappe.desk.query_report
    # query_report binds make_xlsx at import time, so whether it picked up the
    # BS converting patched_make_xlsx depended on import order; bind it here
    query_report.make_xlsx = frappe.utils.xlsxutils.make_xlsx
    query_report.generate_report_result = _patch_function(query_report.generate_report_result)
    query_report.get_prepared_report_result = _patch_function(query_report.get_prepared_report_result)
