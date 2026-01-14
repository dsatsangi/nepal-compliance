
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
    console.log("Nepal Compliance: Checking session default settings...");
    frappe.db.get_single_value("Nepal Compliance Settings", "enforce_session_defaults")
        .then(enabled => {
            console.log("Nepal Compliance: Enforce session defaults setting:", enabled);
            if (enabled) {
                const company = frappe.defaults.get_user_default("company");
                console.log("Nepal Compliance: Session default company:", company);
                if (company) {
                    // cleanup existing company filters to avoid duplicates if any
                    // actually standard filter area handles simple duplicates well, but let's be safe
                    // listview.filter_area.remove("company"); 
                    console.log("Nepal Compliance: Applying filter for company", company);
                    listview.filter_area.add([[listview.doctype, "company", "=", company]]);
                } else {
                    console.log("Nepal Compliance: No company session default found.");
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
        console.log("Nepal Compliance: session_defaults.js loaded for", doctype);
        if (old_onload) {
            old_onload.call(this, listview);
        }
        apply_session_filter(listview);
    };
});
