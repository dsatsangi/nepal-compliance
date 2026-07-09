(function () {
    if (window.__nc_session_defaults_loaded) {
        return;
    }
    window.__nc_session_defaults_loaded = true;

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
        "Asset",
        "Warehouse",
        "Bin"
    ];

    const session_default_reports = [
        "Balance Sheet",
        "Profit and Loss Statement",
        "Cash Flow",
        "Trial Balance",
        "General Ledger",
        "Stock Balance",
        "Stock Ledger",
        "Stock Projected Qty",
        "Warehouse Wise Stock Balance",
        "Warehouse wise Item Balance Age and Value",
        "Total Stock Summary",
        "Stock Ageing"
    ];

    const should_enforce_session_defaults = function () {
        return Boolean(frappe.boot?.nepal_compliance_settings?.enforce_session_defaults);
    };

    const get_session_company = function () {
        return frappe.defaults.get_user_default("company") || frappe.defaults.get_user_default("Company");
    };

    const apply_session_filter = function (listview) {
        if (!should_enforce_session_defaults()) {
            return;
        }

        const company = get_session_company();
        if (!company || !listview?.filter_area) {
            return;
        }

        let filters = listview.filter_area.get();
        const company_filters = filters.filter(f => f[1] === "company");
        const correct_filter_exists = company_filters.find(f => f[3] === company);

        if (company_filters.length === 1 && correct_filter_exists) {
            return;
        }

        filters = filters.filter(f => f[1] !== "company");
        filters.push([listview.doctype, "company", "=", company]);

        listview.filter_area.clear(false).then(() => {
            listview.filter_area.set(filters);
        });
    };

    const has_company_filter = function (query_report) {
        return query_report?.report_settings?.filters?.some(df => df.fieldname === "company");
    };

    const should_force_query_report_company = function (query_report) {
        if (!should_enforce_session_defaults() || !query_report?.report_name) {
            return false;
        }

        return session_default_reports.includes(query_report.report_name) || has_company_filter(query_report);
    };

    const patch_query_report = function () {
        if (!frappe.views?.QueryReport?.prototype || frappe.views.QueryReport.prototype.__nc_session_defaults_patched) {
            return Boolean(frappe.views?.QueryReport?.prototype);
        }

        const original_refresh_report = frappe.views.QueryReport.prototype.refresh_report;
        const original_refresh = frappe.views.QueryReport.prototype.refresh;

        frappe.views.QueryReport.prototype.refresh_report = function (route_options) {
            const company = get_session_company();
            if (company && should_force_query_report_company(this)) {
                route_options = Object.assign({}, route_options || frappe.route_options || {}, { company });
            }

            return original_refresh_report.call(this, route_options);
        };

        frappe.views.QueryReport.prototype.refresh = function (have_filters_changed) {
            const company = get_session_company();
            const company_filter = this.get_filter?.("company", false);
            const current_company = company_filter?.get_value();

            if (
                company
                && company_filter
                && current_company !== company
                && should_force_query_report_company(this)
                && !this.__nc_setting_session_company
            ) {
                this.__nc_setting_session_company = true;
                this.set_filter_value("company", company);
                this.__nc_setting_session_company = false;
                return;
            }

            return original_refresh.call(this, have_filters_changed);
        };

        frappe.views.QueryReport.prototype.__nc_session_defaults_patched = true;
        return true;
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

    if (!patch_query_report()) {
        const patch_interval = setInterval(() => {
            if (patch_query_report()) {
                clearInterval(patch_interval);
            }
        }, 100);
    }
})();
