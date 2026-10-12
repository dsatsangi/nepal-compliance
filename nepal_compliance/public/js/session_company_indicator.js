(function () {
    const WRAPPER_ID_PREFIX = "nepal-compliance-session-company-wrapper";
    const INDICATOR_ID_PREFIX = "nepal-compliance-session-company";
    const company_abbr_cache = {};

    function get_session_company() {
        return (
            frappe.defaults.get_user_default("company") ||
            frappe.defaults.get_user_default("Company")
        );
    }

    // Frappe 16.51+ renders Search / Notification rows in `.standard-items-band`; older v16
    // builds used `.standard-items-sections`. The selector is added as a row in the same band.
    function get_sidebar_target() {
        const sidebar = document.querySelector(".body-sidebar");
        if (!sidebar) {
            return null;
        }

        const band = sidebar.querySelector(".standard-items-band");
        if (band) {
            return { parent: band, before: null, placement: "sidebar" };
        }

        const legacy_items = sidebar.querySelector(".standard-items-sections");
        if (legacy_items) {
            return { parent: sidebar, before: legacy_items, placement: "sidebar" };
        }

        const sidebar_top = sidebar.querySelector(".body-sidebar-top");
        if (sidebar_top) {
            return { parent: sidebar, before: sidebar_top, placement: "sidebar" };
        }

        return null;
    }

    // The /desk apps page (Frappe 16.51+) has its own top bar with no body sidebar in view;
    // the selector goes in its right-hand cluster, ahead of the cloud / notification buttons.
    function get_desktop_target() {
        const navbar = document.querySelector(".desktop-navbar");
        const anchor = navbar?.querySelector(".desktop-cloud-settings, .desktop-notifications");
        if (!anchor) {
            return null;
        }

        return { parent: anchor.parentElement, before: anchor, placement: "desktop" };
    }

    function get_indicator_targets() {
        return [get_sidebar_target(), get_desktop_target()].filter(Boolean);
    }

    function get_wrapper_id(placement) {
        return `${WRAPPER_ID_PREFIX}-${placement}`;
    }

    function get_indicator_id(placement) {
        return `${INDICATOR_ID_PREFIX}-${placement}`;
    }

    function remove_indicator() {
        document.querySelectorAll(".nepal-session-company-wrapper").forEach(wrapper => wrapper.remove());
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
        value.textContent = company ? "..." : __("Set Company");

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

        if (company === get_session_company()) {
            wrapper.dialog?.hide();
            return;
        }

        const dialog = wrapper.dialog;
        if (dialog) {
            dialog.disable_primary_action();
        }
        wrapper.classList.add("is-saving");
        wrapper.company_control?.$input?.prop("disabled", true);

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
            wrapper.classList.remove("is-saving");
            wrapper.company_control?.$input?.prop("disabled", false);
        }
    }

    function render_company_indicator_button(wrapper, company) {
        const placement = wrapper.dataset.placement || "sidebar";
        let indicator = document.getElementById(get_indicator_id(placement));

        indicator?.remove();
        wrapper.innerHTML = "";
        wrapper.company_control = null;

        indicator = document.createElement(placement === "desktop" ? "button" : "div");
        indicator.id = get_indicator_id(placement);
        indicator.className = placement === "desktop"
            ? "btn-reset nepal-session-company-indicator nepal-session-company-pill"
            : "standard-sidebar-item nepal-session-company-indicator";
        indicator.dataset.company = company || "";
        indicator.title = company
            ? __("Active session default company: {0}", [company])
            : __("Active session default company");

        const label_html = `
            <span class="indicator-caption">${__("Company")}</span>
            <span class="indicator-value"></span>
        `;
        const icon_html = frappe.utils.icon("building", "sm", "", "", "current-color");
        const caret_html = frappe.utils.icon("chevrons-up-down", "xs", "", "", "current-color");

        if (placement === "desktop") {
            indicator.type = "button";
            indicator.setAttribute("aria-haspopup", "dialog");
            indicator.setAttribute("aria-label", __("Session Default Company"));
            indicator.innerHTML = `
                <span class="indicator-icon">${icon_html}</span>
                <span class="indicator-label">${label_html}</span>
                <span class="indicator-caret" aria-hidden="true">${caret_html}</span>
            `;
        } else {
            indicator.innerHTML = `
                <a class="item-anchor" role="button" tabindex="0" aria-haspopup="dialog"
                    aria-label="${__("Session Default Company")}">
                    <span class="sidebar-item-icon" item-icon="building">${icon_html}</span>
                    <span class="sidebar-item-label indicator-label">${label_html}</span>
                    <span class="sidebar-item-suffix indicator-caret" aria-hidden="true">
                        ${caret_html}
                    </span>
                </a>
            `;
        }
        set_indicator_label(indicator, company);
        const anchor = indicator.querySelector(".item-anchor") || indicator;
        anchor.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            open_session_company_dialog(wrapper);
        });
        anchor.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open_session_company_dialog(wrapper);
            }
        });

        wrapper.insertBefore(indicator, wrapper.firstChild);
    }

    function render_session_company() {
        if (!frappe.boot?.nepal_compliance_settings?.enforce_session_defaults) {
            remove_indicator();
            return;
        }

        const company = get_session_company();
        const targets = get_indicator_targets();

        if (!targets.length) {
            remove_indicator();
            return;
        }

        const active_wrapper_ids = new Set(targets.map(target => get_wrapper_id(target.placement)));
        document.querySelectorAll(".nepal-session-company-wrapper").forEach(wrapper => {
            if (!active_wrapper_ids.has(wrapper.id)) {
                wrapper.remove();
            }
        });

        targets.forEach(target => {
            let wrapper = document.getElementById(get_wrapper_id(target.placement));

            if (!wrapper) {
                wrapper = document.createElement("div");
                wrapper.id = get_wrapper_id(target.placement);
                wrapper.className = "nepal-session-company-wrapper";
            }

            wrapper.dataset.placement = target.placement;
            render_company_indicator_button(wrapper, company);

            const in_place = target.before
                ? target.before.previousElementSibling === wrapper
                : target.parent.lastElementChild === wrapper;
            if (!in_place) {
                target.parent.insertBefore(wrapper, target.before);
            }
        });
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
        watch_mounts();
    });

    // The sidebar is rebuilt when switching modules and the /desk page re-renders its top bar on
    // every show; both drop the selector, so put it back whenever a mount point lacks it.
    function watch_mounts() {
        if (watch_mounts.observer) {
            return;
        }

        let scheduled = false;
        watch_mounts.observer = new MutationObserver(() => {
            if (scheduled || !frappe.boot?.nepal_compliance_settings?.enforce_session_defaults) {
                return;
            }
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                const missing = get_indicator_targets().some(target => {
                    const wrapper = document.getElementById(get_wrapper_id(target.placement));
                    return !wrapper || !target.parent.contains(wrapper);
                });
                if (missing) {
                    render_session_company();
                }
            });
        });
        watch_mounts.observer.observe(document.body, { childList: true, subtree: true });
    }

    $(document).on("sidebar_setup page-change", () => {
        setTimeout(() => {
            render_session_company();
            watch_mounts();
        }, 0);
    });

    frappe.router?.on?.("change", render_session_company);
})();
