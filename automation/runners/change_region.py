"""
Apple ID change-region runner: login then navigate to region/country and set target region.
"""
from __future__ import annotations

import time
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


def run_change_region(
    driver: Any,
    account: str,
    password: str,
    target_region: str = "US",
    delimiter: str | None = None,
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
    pwd = parsed.password
    outcome = perform_apple_login(driver, acc, pwd, log=log, timeout_ms=timeout_ms, skip_delays=skip_delays)
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
            "errorMessage": "账号密码正确，但需要双重认证/密保，无法自动完成改区",
        }
    try:
        link = driver.select("a[href*='country'], a[href*='region'], a[href*='地区']", wait=10)
        if link and hasattr(link, "click"):
            link.click()
        elif hasattr(driver, "click"):
            driver.click("a[href*='country']", wait=5)
        time.sleep(1.5)
        sel = driver.select("select[name*='country'], select[id*='country']", wait=8)
        if sel and hasattr(sel, "select_option"):
            sel.select_option(target_region)
        elif hasattr(sel, "run_js"):
            sel.run_js(f"(el) => {{ el.value = '{target_region}'; el.dispatchEvent(new Event('change')); }}")
        time.sleep(0.5)
        save_btn = driver.select("button", wait=5) or driver.get_element_containing_text("保存", wait=3) or driver.get_element_containing_text("Update", wait=3)
        if save_btn and hasattr(save_btn, "click"):
            save_btn.click()
        elif hasattr(driver, "click"):
            driver.click("button")
        time.sleep(2)
    except Exception:
        return {
            "success": False,
            "errorCode": ERROR_CODES["UNKNOWN"],
            "errorMessage": "地区修改失败，请重试",
        }
    return {
        "success": True,
        "newRegion": target_region,
        "data": {"account": acc, "oldRegion": parsed.region or "未知", "newRegion": target_region},
    }
