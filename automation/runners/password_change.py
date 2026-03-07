"""
Apple ID change-password runner: login then navigate to security and change password.
"""
from __future__ import annotations

import random
import time
from typing import Any

from card_parser import parse_card_content
from apple_login_flow import perform_apple_login

ERROR_CODES = {
    "INVALID_CREDENTIALS": "INVALID_CREDENTIALS",
    "ACCOUNT_LOCKED": "ACCOUNT_LOCKED",
    "TIMEOUT": "TIMEOUT",
    "TWO_FA_REQUIRED": "TWO_FA_REQUIRED",
    "PASSWORD_CHANGE_FAILED": "PASSWORD_CHANGE_FAILED",
    "UNKNOWN": "UNKNOWN",
}


def _generate_password(length: int = 14) -> str:
    lower = "abcdefghijkmnopqrstuvwxyz"
    upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    digits = "23456789"
    special = "!@#$%"
    first = random.choice(lower) + random.choice(upper) + random.choice(digits) + random.choice(special)
    rest = "".join(random.choices(lower + upper + digits + special, k=length - 4))
    return "".join(random.sample(first + rest, len(first + rest)))


def run_password_change(
    driver: Any,
    account: str,
    password: str,
    delimiter: str | None = None,
    password_length: int = 14,
    timeout_ms: int = 60_000,
    skip_delays: bool = False,
    log: Any = None,
) -> dict[str, Any]:
    content = f"{account}\n{password}" if delimiter is None else f"{account}{delimiter}{password}"
    parsed = parse_card_content(content, delimiter=delimiter)
    if not parsed or not parsed.account or not parsed.password:
        return {
            "success": False,
            "errorCode": ERROR_CODES["INVALID_CREDENTIALS"],
            "errorMessage": "无法解析卡密内容，请检查格式或设置正确的卡密分隔符",
        }
    acc = parsed.account
    old_pwd = parsed.password
    new_pwd = _generate_password(password_length)
    outcome = perform_apple_login(driver, acc, old_pwd, log=log, timeout_ms=timeout_ms, skip_delays=skip_delays)
    if not outcome.success:
        code = outcome.error_code or "INVALID_CREDENTIALS"
        if code == "ACCOUNT_LOCKED":
            code = ERROR_CODES["ACCOUNT_LOCKED"]
        elif code == "TIMEOUT":
            code = ERROR_CODES["TIMEOUT"]
        elif code == "TWO_FA_REQUIRED":
            code = ERROR_CODES["TWO_FA_REQUIRED"]
        else:
            code = ERROR_CODES["INVALID_CREDENTIALS"]
        return {"success": False, "errorCode": code, "errorMessage": outcome.error_message or "登录失败"}
    if outcome.two_factor_required:
        return {
            "success": False,
            "errorCode": ERROR_CODES["TWO_FA_REQUIRED"],
            "errorMessage": "账号密码正确，但需要双重认证/密保，无法自动完成改密",
        }
    try:
        link = driver.select("a[href*='password'], a[href*='安全']", wait=10)
        if link and hasattr(link, "click"):
            link.click()
        elif hasattr(driver, "click"):
            driver.click("a[href*='password']", wait=5)
        time.sleep(1.5)
        pw_inputs = driver.select_all("input[type='password']")
        if len(pw_inputs) >= 2 and hasattr(pw_inputs[1], "type"):
            pw_inputs[1].type(new_pwd)
        else:
            driver.type("input[type='password']", new_pwd)
        time.sleep(0.5)
        if len(pw_inputs) >= 3 and hasattr(pw_inputs[2], "type"):
            pw_inputs[2].type(new_pwd)
        save_btn = driver.select("button", wait=5) or driver.get_element_containing_text("保存", wait=3) or driver.get_element_containing_text("Save", wait=3)
        if save_btn and hasattr(save_btn, "click"):
            save_btn.click()
        elif hasattr(driver, "click"):
            driver.click("button")
        time.sleep(2)
    except Exception:
        return {
            "success": False,
            "errorCode": ERROR_CODES["PASSWORD_CHANGE_FAILED"],
            "errorMessage": "密码修改流程失败或页面结构变化",
        }
    return {
        "success": True,
        "newPassword": new_pwd,
        "data": {"account": acc, "passwordLength": len(new_pwd)},
    }
