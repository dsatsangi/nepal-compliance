import frappe

def get_session_default_conditions(user=None):
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

    company = frappe.defaults.get_user_default("company", user) or frappe.defaults.get_user_default("Company", user)
    
    if company:
        # frappe.db.escape escapes the string AND adds surrounding quotes
        return f"company = {frappe.db.escape(company)}"

    return ""


def get_customer_company_conditions(user=None):
    """Customer has no direct "company" field; its company association lives in the
    "Default Accounts" (Party Account) child table. A customer with no rows at all
    hasn't transacted with any company yet, so it stays visible everywhere until
    it's explicitly tied to one."""
    if not user:
        user = frappe.session.user

    enforce = frappe.db.get_single_value("Nepal Compliance Settings", "enforce_session_defaults")
    if not enforce:
        return ""

    company = frappe.defaults.get_user_default("company", user) or frappe.defaults.get_user_default("Company", user)
    if not company:
        return ""

    company = frappe.db.escape(company)

    return f"""(
        not exists (
            select 1 from `tabParty Account` pa
            where pa.parenttype = 'Customer' and pa.parent = `tabCustomer`.name
        )
        or exists (
            select 1 from `tabParty Account` pa
            where pa.parenttype = 'Customer' and pa.parent = `tabCustomer`.name and pa.company = {company}
        )
    )"""
