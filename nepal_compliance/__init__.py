__version__ = "0.1.0"

# Apply monkey patches that need to load with the app.
from nepal_compliance.patches import regional_overrides  # noqa: F401
from nepal_compliance.patches.sanitize_html_patch import apply as apply_sanitize_html_patch

apply_sanitize_html_patch()
