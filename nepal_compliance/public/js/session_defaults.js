
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
    frappe.db.get_single_value("Nepal Compliance Settings", "enforce_session_defaults")
        .then(enabled => {
            if (enabled) {
                if (company) {
                    // Start by removing any existing company filters to ensure session default takes precedence
                    if (listview.filter_area.exists([listview.doctype, "company", "=", company])) {
                        // if the correct filter already exists, do nothing to avoid refresh loop
                        return;
                    }

                    // Remove any other company filters (e.g. from previous session or wrong default)
                    listview.filter_area.remove("company");

                    // Apply the correct session default
                    listview.filter_area.add([[listview.doctype, "company", "=", company]]);
                }
            }
        })
        .catch(err => {
            console.error("Nepal Compliance: Error fetching settings", err);
        });
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
