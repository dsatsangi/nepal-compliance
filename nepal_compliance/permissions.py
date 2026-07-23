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


def _party_account_company_conditions(party_doctype, user=None):
    """Customer/Supplier have no direct "company" field; their company association
    lives in the "Default Accounts" (Party Account) child table. A party with no
    rows at all hasn't transacted with any company yet, so it stays visible
    everywhere until it's explicitly tied to one."""
    if not user:
        user = frappe.session.user

    enforce = frappe.db.get_single_value("Nepal Compliance Settings", "enforce_session_defaults")
    if not enforce:
        return ""

    company = frappe.defaults.get_user_default("company", user) or frappe.defaults.get_user_default("Company", user)
    if not company:
        return ""

    company = frappe.db.escape(company)
    table = f"`tab{party_doctype}`"
    party_doctype = frappe.db.escape(party_doctype)

    return f"""(
        not exists (
            select 1 from `tabParty Account` pa
            where pa.parenttype = {party_doctype} and pa.parent = {table}.name
        )
        or exists (
            select 1 from `tabParty Account` pa
            where pa.parenttype = {party_doctype} and pa.parent = {table}.name and pa.company = {company}
        )
    )"""


def get_customer_company_conditions(user=None):
    return _party_account_company_conditions("Customer", user)


def get_supplier_company_conditions(user=None):
    return _party_account_company_conditions("Supplier", user)


def get_item_company_conditions(user=None):
    """Item has no direct "company" field; its company association lives in the
    "Item Defaults" child table. An item with no rows at all hasn't transacted
    with any company yet, so it stays visible everywhere until it's explicitly
    tied to one."""
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
            select 1 from `tabItem Default` idf
            where idf.parenttype = 'Item' and idf.parent = `tabItem`.name
        )
        or exists (
            select 1 from `tabItem Default` idf
            where idf.parenttype = 'Item' and idf.parent = `tabItem`.name and idf.company = {company}
        )
    )"""
