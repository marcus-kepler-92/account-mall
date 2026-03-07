"""
Apple ID status test runner: parse card, perform login, return success/failure from signin/complete.
"""
from __future__ import annotations

from typing import Any

from card_parser import parse_card_content
from apple_login_flow import perform_apple_login

ERROR_CODES = {
    "INVALID_CREDENTIALS": "INVALID_CREDENTIALS",
    "ACCOUNT_LOCKED": "ACCOUNT_LOCKED",
    "TIMEOUT": "TIMEOUT",
    "TWO_FA_REQUIRED": "TWO_FA_REQUIRED",
    "UNKNOWN": "UNKNOWN",
}


def run_status_test(
    driver: Any,
    account: str,
    password: str,
    delimiter: str | None = None,
    timeout_ms: int = 90_000,
    skip_delays: bool = False,
    log: Any = None,
) -> dict[str, Any]:
    """
    Run status test for one account. Returns dict with success, errorCode, errorMessage, data, etc.
    """
    content = f"{account}\n{password}" if delimiter is None else f"{account}{delimiter}{password}"
    parsed = parse_card_content(content, delimiter=delimiter)
    if not parsed or not parsed.account or not parsed.password:
        return {
            "success": False,
            "errorCode": ERROR_CODES["INVALID_CREDENTIALS"],
            "errorMessage": "无法解析卡密内容，请检查格式或设置正确的卡密分隔符（如 ----、:、|）",
        }
    acc = parsed.account
    pwd = parsed.password
    outcome = perform_apple_login(driver, acc, pwd, log=log, timeout_ms=timeout_ms, skip_delays=skip_delays)
    if outcome.success:
        return {
            "success": True,
            "data": {
                "account": acc,
                "status": "active",
                "twoFactorRequired": outcome.two_factor_required,
            },
        }
    code = outcome.error_code or "UNKNOWN"
    if code == "ACCOUNT_LOCKED":
        code = ERROR_CODES["ACCOUNT_LOCKED"]
    elif code == "TIMEOUT":
        code = ERROR_CODES["TIMEOUT"]
    else:
        code = ERROR_CODES["INVALID_CREDENTIALS"]
    return {
        "success": False,
        "errorCode": code,
        "errorMessage": outcome.error_message or "登录失败",
    }
