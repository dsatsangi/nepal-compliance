import frappe 

def get_boot_info(bootinfo):
    if frappe.session.user != "Guest":
        # Check if session defaults should be enforced
        enforce_session_defaults = frappe.db.get_single_value("Nepal Compliance Settings", "enforce_session_defaults")
        bootinfo["nepal_compliance_settings"] = {
            "enforce_session_defaults": enforce_session_defaults
        }
        
        user_doc = frappe.get_doc("User", frappe.session.user)
        bootinfo["user"]["use_ad_date"] = user_doc.get("use_ad_date", 0)