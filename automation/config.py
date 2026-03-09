"""
Environment and constants for Apple automation.
Load from .env via python-dotenv; override via CLI args where applicable.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from automation dir or cwd
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)
load_dotenv()

# Apple login
APPLE_ID_SIGN_IN_URL = os.getenv("AUTOMATION_APPLE_LOGIN_URL", "https://account.apple.com")
APPLE_AUTH_SIGNIN_COMPLETE_URL = "idmsa.apple.com/appleauth/auth/signin/complete"
APPLE_SERVICE_ERROR_ACCOUNT_NOT_ACTIVE = "-20755"

# Timeouts (ms)
DEFAULT_TIMEOUT_MS = 90_000
NAV_TIMEOUT_MS = 15_000
STEP_TIMEOUT_MS = 20_000
RESULT_TIMEOUT_MS = 8_000
IFRAME_IDMSA_WAIT_MS = 12_000
PAGE_READY_MS = 8_000

def get_timeout_ms() -> int:
    raw = os.getenv("AUTOMATION_TIMEOUT_MS")
    if raw is not None:
        try:
            return max(int(raw), 50_000)
        except ValueError:
            pass
    return DEFAULT_TIMEOUT_MS


def get_headless() -> bool:
    v = os.getenv("AUTOMATION_HEADLESS", "0").strip().lower()
    return v in ("1", "true", "yes")


def get_proxy() -> str | None:
    return os.getenv("AUTOMATION_PROXY") or None
