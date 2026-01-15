import frappe

def get_session_default_conditions(user):
    if not user:
        user = frappe.session.user

    # Admin should bypass this? Usually yes, but "session defaults" implies user choice.
    # However, standard practice is strict if enabled.
    # Let's stick to the setting.

    # Optimization: Use the bootinfo cache we added? 
    # permission queries run on server, bootinfo is client. 
    # We must fetch from DB or cache. `get_single_value` is cached by request/redis.
    
    enforce = frappe.db.get_single_value("Nepal Compliance Settings", "enforce_session_defaults")
    if not enforce:
        return ""

    company = frappe.defaults.get_user_default("company", user)
    
    if company:
        # frappe.db.escape escapes the string AND adds surrounding quotes
        return f"company = {frappe.db.escape(company)}"

    return ""
