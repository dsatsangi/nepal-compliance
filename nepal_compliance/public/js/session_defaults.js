
const session_default_doctypes = [
    "Journal Entry",
    "Payment Entry",
    "Purchase Invoice",
    "Purchase Receipt",
    "Stock Entry",
    "Sales Invoice",
    "Delivery Note",
    "Sales Order",
    "Purchase Order",
    "Material Request",
    "Stock Reconciliation",
    "Asset"
];

const apply_session_filter = function (listview) {
    const settings = frappe.boot.nepal_compliance_settings;
    if (settings && settings.enforce_session_defaults) {
        const company = frappe.defaults.get_user_default("company");

        if (company) {
            // Get all current filters
            let filters = listview.filter_area.get();
            // Check if the correct filter is already the ONLY company filter
            const company_filters = filters.filter(f => f[1] === "company");
            const correct_filter_exists = company_filters.find(f => f[3] === company);

            if (company_filters.length === 1 && correct_filter_exists) {
                return;
            }

            // Resetting filters to enforce company
            // Remove ALL company filters from the list
            filters = filters.filter(f => f[1] !== "company");

            // Add the correct company filter
            filters.push([listview.doctype, "company", "=", company]);

            // Clear and Set
            // We use clear(false) to avoid double refresh, then set() calls refresh
            if (listview.filter_area) {
                listview.filter_area.clear(false).then(() => {
                    listview.filter_area.set(filters);
                });
            }
        }
    }
};

session_default_doctypes.forEach(doctype => {
    frappe.listview_settings[doctype] = frappe.listview_settings[doctype] || {};
    const old_onload = frappe.listview_settings[doctype].onload;

    frappe.listview_settings[doctype].onload = function (listview) {
        if (old_onload) {
            old_onload.call(this, listview);
        }
        apply_session_filter(listview);
    };
});
