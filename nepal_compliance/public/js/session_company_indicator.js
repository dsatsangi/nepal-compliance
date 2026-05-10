(function () {
    const WRAPPER_ID = "nepal-compliance-session-company-wrapper";
    const INDICATOR_ID = "nepal-compliance-session-company";
    const MENU_ID = "nepal-compliance-session-company-menu";
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

    function close_menu() {
        const menu = document.getElementById(MENU_ID);
        const indicator = document.getElementById(INDICATOR_ID);

        menu?.classList.add("hidden");
        indicator?.setAttribute("aria-expanded", "false");
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

    function create_dropdown(wrapper) {
        const menu = document.createElement("div");
        menu.id = MENU_ID;
        menu.className = "nepal-session-company-menu hidden";
        menu.innerHTML = `
            <div class="company-link-field"></div>
            <div class="company-menu-actions">
                <button class="btn btn-xs btn-primary apply-company" type="button">
                    ${__("Apply")}
                </button>
            </div>
        `;

        wrapper.appendChild(menu);

        const control = frappe.ui.form.make_control({
            parent: menu.querySelector(".company-link-field"),
            df: {
                fieldtype: "Link",
                fieldname: "session_company",
                label: __("Change Company"),
                options: "Company",
                placeholder: __("Select Company")
            },
            render_input: true
        });

        control.set_value(get_session_company() || "");
        wrapper.company_control = control;
        add_clear_button(wrapper, control);

        menu.querySelector(".apply-company").addEventListener("click", () => {
            set_session_company(wrapper);
        });
    }

    function add_clear_button(wrapper, control) {
        const clear_button = document.createElement("button");
        clear_button.type = "button";
        clear_button.className = "nepal-session-company-clear";
        clear_button.title = __("Clear Company");
        clear_button.setAttribute("aria-label", __("Clear Company"));
        clear_button.innerHTML = "&times;";

        clear_button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            control.set_value("");
            control.$input?.focus();
        });

        control.$wrapper.find(".control-input").append(clear_button);
    }

    function toggle_menu(wrapper) {
        if (!wrapper.company_control) {
            create_dropdown(wrapper);
        }

        const menu = wrapper.querySelector(`#${MENU_ID}`);
        const indicator = wrapper.querySelector(`#${INDICATOR_ID}`);
        const is_hidden = menu.classList.contains("hidden");

        document.querySelectorAll(".nepal-session-company-menu").forEach(item => {
            if (item !== menu) {
                item.classList.add("hidden");
            }
        });

        menu.classList.toggle("hidden", !is_hidden);
        indicator.setAttribute("aria-expanded", is_hidden ? "true" : "false");

        if (is_hidden) {
            wrapper.company_control.set_value(get_session_company() || "");
            setTimeout(() => wrapper.company_control.$input?.focus(), 0);
        }
    }

    async function set_session_company(wrapper) {
        const company = wrapper.company_control?.get_value();

        if (!company) {
            frappe.msgprint(__("Please select a company."));
            return;
        }

        const apply_button = wrapper.querySelector(".apply-company");
        apply_button.disabled = true;

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
            close_menu();
            render_session_company();
            frappe.show_alert({
                message: __("Default company changed to {0}", [company]),
                indicator: "green"
            });
        } finally {
            apply_button.disabled = false;
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
            event.stopImmediatePropagation();
            toggle_menu(wrapper);
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

    document.addEventListener("click", event => {
        if (!event.target.closest(`#${WRAPPER_ID}`)) {
            close_menu();
        }
    });

    frappe.router?.on?.("change", render_session_company);
})();
