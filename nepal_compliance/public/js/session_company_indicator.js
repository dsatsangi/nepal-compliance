(function () {
    const WRAPPER_ID = "nepal-compliance-session-company-wrapper";
    const INDICATOR_ID = "nepal-compliance-session-company";
    const company_abbr_cache = {};

    function get_session_company() {
        return (
            frappe.defaults.get_user_default("company") ||
            frappe.defaults.get_user_default("Company")
        );
    }

    function get_frappe_major_version() {
        const version = frappe.boot?.versions?.frappe || "";
        return Number.parseInt(version.split(".")[0], 10) || 0;
    }

    function is_frappe_v16() {
        return get_frappe_major_version() === 16;
    }

    function get_search_container() {
        return (
            document.querySelector(".navbar .search-bar") ||
            document.querySelector(".navbar .navbar-search") ||
            document.querySelector(".navbar .awesomplete") ||
            document.querySelector(".navbar form[role='search']")
        );
    }

    function get_indicator_target() {
        if (is_frappe_v16()) {
            const sidebar = document.querySelector(".body-sidebar");
            const standard_items = sidebar?.querySelector(".standard-items-sections");

            if (!sidebar || !standard_items) {
                return null;
            }

            return {
                parent: sidebar,
                before: standard_items,
                placement: "sidebar"
            };
        }

        const search_container = get_search_container();

        if (!search_container) {
            return null;
        }

        return {
            parent: search_container.parentNode,
            before: search_container,
            placement: "navbar"
        };
    }

    function remove_indicator() {
        document.getElementById(WRAPPER_ID)?.remove();
    }

    function set_local_company_default(company) {
        if (frappe.boot?.user?.defaults) {
            frappe.boot.user.defaults.company = company;
            frappe.boot.user.defaults.Company = company;
        }
    }

    async function get_company_indicator_label(company) {
        if (!company) {
            return __("Set Company");
        }

        if (company_abbr_cache[company]) {
            return company_abbr_cache[company];
        }

        try {
            const response = await frappe.db.get_value("Company", { name: company }, "abbr");
            const abbr = response?.message?.abbr;
            company_abbr_cache[company] = abbr || company;
        } catch {
            company_abbr_cache[company] = company;
        }

        return company_abbr_cache[company];
    }

    function set_indicator_label(indicator, company) {
        const value = indicator.querySelector(".indicator-value");
        value.textContent = company || __("Set Company");

        get_company_indicator_label(company).then(label => {
            if (indicator.dataset.company === (company || "")) {
                value.textContent = label;
            }
        });
    }

    function get_session_company_dialog(wrapper) {
        if (wrapper.dialog) {
            return wrapper.dialog;
        }

        const dialog = new frappe.ui.Dialog({
            title: __("Session Defaults"),
            fields: [
                {
                    fieldtype: "Link",
                    fieldname: "session_company",
                    label: __("Default Company"),
                    options: "Company",
                    placeholder: __("Select Company")
                }
            ],
            primary_action_label: __("Apply"),
            primary_action(values) {
                set_session_company(wrapper, values.session_company);
            }
        });

        wrapper.dialog = dialog;
        return dialog;
    }

    function open_session_company_dialog(wrapper) {
        const dialog = get_session_company_dialog(wrapper);
        dialog.set_value("session_company", get_session_company() || "");
        dialog.show();
        setTimeout(() => dialog.fields_dict.session_company.set_focus(), 0);
    }

    async function set_session_company(wrapper, company) {
        if (!company) {
            frappe.msgprint(__("Please select a company."));
            return;
        }

        const dialog = wrapper.dialog;
        if (dialog) {
            dialog.disable_primary_action();
        }

        try {
            const response = await frappe.call({
                method: "frappe.core.doctype.session_default_settings.session_default_settings.set_session_default_values",
                args: {
                    default_values: JSON.stringify({ company })
                }
            });

            if (response.message !== "success") {
                frappe.throw(__("Could not update the default company."));
            }

            set_local_company_default(company);
            if (dialog) {
                dialog.hide();
            }

            if (frappe.ui.toolbar?.clear_cache) {
                await frappe.ui.toolbar.clear_cache();
            } else if (typeof frappe.clear_cache === "function") {
                frappe.clear_cache();
            }

            window.location.reload();
        } finally {
            if (dialog) {
                dialog.enable_primary_action();
            }
        }
    }

    function render_session_company() {
        if (!frappe.boot?.nepal_compliance_settings?.enforce_session_defaults) {
            remove_indicator();
            return;
        }

        const company = get_session_company();
        const target = get_indicator_target();

        if (!target) {
            remove_indicator();
            return;
        }

        let wrapper = document.getElementById(WRAPPER_ID);
        let indicator = document.getElementById(INDICATOR_ID);

        if (!wrapper) {
            wrapper = document.createElement("div");
            wrapper.id = WRAPPER_ID;
            wrapper.className = "nepal-session-company-wrapper";
        }

        wrapper.dataset.placement = target.placement;

        indicator?.remove();
        indicator = document.createElement("button");
        indicator.id = INDICATOR_ID;
        indicator.type = "button";
        indicator.className = "nepal-session-company-indicator";
        indicator.setAttribute("aria-haspopup", "true");
        indicator.setAttribute("aria-expanded", "false");
        indicator.dataset.company = company || "";
        indicator.title = company
            ? __("Active session default company: {0}", [company])
            : __("Active session default company");
        indicator.innerHTML = `
            <span class="indicator-label">${__("Company")}</span>
            <span class="indicator-value"></span>
            <span class="indicator-caret" aria-hidden="true">&#9662;</span>
        `;
        set_indicator_label(indicator, company);
        indicator.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            open_session_company_dialog(wrapper);
        });

        wrapper.insertBefore(indicator, wrapper.firstChild);

        if (target.before.previousElementSibling !== wrapper) {
            target.parent.insertBefore(wrapper, target.before);
        }
    }

    function watch_default_updates() {
        if (!frappe.defaults?.set_user_default_local || frappe.defaults.set_user_default_local.__nepal_compliance_patched) {
            return;
        }

        const set_user_default_local = frappe.defaults.set_user_default_local;
        frappe.defaults.set_user_default_local = function (...args) {
            const result = set_user_default_local.apply(this, args);

            if (args[0] === "company" || args[0] === "Company") {
                setTimeout(render_session_company, 0);
            }

            return result;
        };
        frappe.defaults.set_user_default_local.__nepal_compliance_patched = true;
    }

    frappe.after_ajax(() => {
        render_session_company();
        watch_default_updates();
    });

    $(document).on("sidebar_setup page-change", () => {
        if (is_frappe_v16()) {
            setTimeout(render_session_company, 0);
        }
    });

    frappe.router?.on?.("change", render_session_company);
})();
