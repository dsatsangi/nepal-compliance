frappe.form.formatters.Date = function(value, df, options, doc) {
    if (!value) return '';

    if (window.__nc_should_use_ad_dates?.()) {
        if (window.__nc_is_bs_date?.(value)) {
            const ad_date = window.__nc_convert_bs_to_ad(value);
            if (ad_date && ad_date !== value) {
                return frappe.datetime.str_to_user(ad_date);
            }
        }
        return frappe.datetime.str_to_user(value);
    }

    if (!window.__nc_is_bs_date?.(value)) {
        try {
            return NepaliFunctions.AD2BS(value, "YYYY-MM-DD", "YYYY-MM-DD");
        } catch (e) {
            console.warn("Failed to convert AD->BS for display", value, e);
        }
    }

    return value;
};
