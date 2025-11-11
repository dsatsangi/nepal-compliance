# Date Preference Behavior

The `User.use_ad_date` flag now controls all client-side date widgets:

- When enabled, standard Frappe AD date controls and formatters are used everywhere, including list views and report filters.
- When disabled, the Nepali calendar continues to supply BS dates for forms, list views, and report filters.
- Client scripts listen for a shared `use-ad-date-ready` event so the correct widgets are activated once the user preference becomes available during boot.

This change ensures users can switch between AD and BS representations without manual overrides in individual views.
