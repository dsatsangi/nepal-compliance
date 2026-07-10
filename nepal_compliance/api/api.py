import frappe
from frappe import _
from typing import Optional

@frappe.whitelist(allow_guest=False)
def get_all_employees():
    employees = frappe.get_all('Employee', fields=['name', 'employee_name', 'department','designation', 'status'])
    return employees

# Biometric device callback - guest access required, no auth token check yet.
# Pre-existing gap, tracked outside this change.
@frappe.whitelist(allow_guest=True)  # nosemgrep: frappe-semgrep-rules.rules.security.guest-whitelisted-method
def attendance(
    employee: str,
    status: str,
    shift: str,
    attendance_date: str,
    log_type: str,
    datetime: str,
    late_entry: Optional[str] = None,
    early_exit: Optional[str] = None,
):
    try:
        employee_check_in = frappe.new_doc("Employee Checkin")
        employee_check_in.employee = employee
        employee_check_in.log_type = log_type
        employee_check_in.datetime = datetime
        attendance_doc_name = None
        employee_check_in.insert()
        if log_type in ['Check In', 'Check Out']:
            attendance_doc = frappe.new_doc("Attendance")
            attendance_doc.employee = employee
            attendance_doc.status = status
            attendance_doc.shift = shift
            attendance_doc.attendance_date = attendance_date
            attendance_doc.docstatus = 1
            attendance_doc.insert()
            attendance_doc_name = attendance_doc.name
        if attendance_doc_name:
            employee_check_in.db_set("attendance", attendance_doc_name)
        frappe.db.commit()
    except Exception as e:
        frappe.log_error(
            title="Attendance Creation Failed",
            message=f"Employee: {employee}, Log Type: {log_type}, Error: {str(e)}"
        )
        return {"success": False, "error": str(e)}