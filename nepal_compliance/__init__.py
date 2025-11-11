__version__ = "0.1.0"

# Apply monkey patches that need to load with the app.
from nepal_compliance.patches import regional_overrides  # noqa: F401
