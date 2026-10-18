// On-screen visibility of the BS date columns that patches/report_bs_columns.py
// adds next to every Date/Datetime column of query and script reports.
// Users who already see dates in BS (use_ad_date off) get them hidden by
// default, since the original date column shows BS for them anyway; everyone
// else sees them. The menu item flips that per user. Exports always carry the
// AD date plus the BS column, whatever is visible here.
(function () {
    if (window.__nc_report_bs_columns_loaded) {
        return;
    }
    window.__nc_report_bs_columns_loaded = true;

    const VISIBILITY_DEFAULT_KEY = "nc_report_bs_dates";
    const BS_SUFFIX = "_nc_bs";

    const feature_enabled = function () {
        return Boolean(frappe.boot?.nepal_compliance_settings?.add_bs_date_column_in_reports);
    };

    const user_sees_ad_dates = function () {
        return frappe.boot?.use_ad_date !== undefined
            ? Boolean(frappe.boot.use_ad_date)
            : frappe.boot?.user?.use_ad_date ?? true;
    };

    const bs_columns_shown = function () {
        const value = frappe.defaults.get_user_default(VISIBILITY_DEFAULT_KEY);
        if (value === "show" || value === "hide") {
            return value === "show";
        }
        return user_sees_ad_dates();
    };

    const toggle_bs_columns = async function (query_report) {
        const show = !bs_columns_shown();
        const r = await frappe.call({
            method: "nepal_compliance.api.api.set_report_bs_dates_visibility",
            args: { show: show ? 1 : 0 }
        });
        frappe.defaults.set_user_default_local(VISIBILITY_DEFAULT_KEY, r.message);
        frappe.show_alert({
            message: show ? __("BS date columns shown") : __("BS date columns hidden"),
            indicator: "green"
        });
        query_report.refresh();
    };

    const patch_query_report = function () {
        const proto = frappe.views?.QueryReport?.prototype;
        if (!proto) {
            return false;
        }
        if (proto.__nc_bs_columns_patched) {
            return true;
        }

        const original_get_menu_items = proto.get_menu_items;
        const original_prepare_columns = proto.prepare_columns;

        proto.get_menu_items = function () {
            const items = original_get_menu_items.call(this);
            if (feature_enabled()) {
                items.push({
                    label: __("Show / Hide BS Date Columns"),
                    action: () => toggle_bs_columns(this),
                    standard: true
                });
            }
            return items;
        };

        proto.prepare_columns = function (columns) {
            const prepared = original_prepare_columns.call(this, columns);
            if (!bs_columns_shown()) {
                prepared.forEach(column => {
                    if (column.fieldname?.endsWith(BS_SUFFIX)) {
                        column.hidden = 1;
                    }
                });
            }
            return prepared;
        };

        proto.__nc_bs_columns_patched = true;
        return true;
    };

    if (!patch_query_report()) {
        const patch_interval = setInterval(() => {
            if (patch_query_report()) {
                clearInterval(patch_interval);
            }
        }, 100);
    }
})();
