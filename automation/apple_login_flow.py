"""
Apple ID login flow: open account.apple.com, fill credentials, submit, then determine
result from signin/complete API response (or URL/DOM fallback).
Matches logic in lib/automation/apple-login-flow.ts; see docs/automation-apple-login-best-practices.md.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any, Callable

from config import (
    APPLE_AUTH_SIGNIN_COMPLETE_URL,
    APPLE_ID_SIGN_IN_URL,
    APPLE_SERVICE_ERROR_ACCOUNT_NOT_ACTIVE,
    RESULT_TIMEOUT_MS,
    STEP_TIMEOUT_MS,
)

# Selectors (from lib/automation/apple-selectors.ts)
APPLE_ACCOUNT_INPUT = "#account_name_text_field"
APPLE_PASSWORD_INPUT = "#password_text_field"
APPLE_SIGN_IN_BUTTON = "#sign-in"
APPLE_SUCCESS_NAV_SELECTOR = "#ac-localnav .ac-localnav-title"
APPLE_SUCCESS_TITLE_REGEX = re.compile(r"管理你的|Manage your|Apple 账户|Apple Account", re.I)


@dataclass
class AppleLoginOutcome:
    success: bool
    error_code: str | None = None
    error_message: str | None = None
    two_factor_required: bool = False


def _parse_service_errors(body: Any) -> tuple[bool, bool, str]:
    """Returns (locked, invalid, first_message)."""
    first_message = ""
    locked = False
    invalid = False
    if not body or not isinstance(body, dict):
        return locked, invalid, first_message
    errs = body.get("serviceErrors")
    if not isinstance(errs, list):
        return locked, invalid, first_message
    for err in errs:
        code = str(err.get("code", ""))
        msg = str(err.get("message", ""))
        if not first_message:
            first_message = msg or "登录失败"
        if code == APPLE_SERVICE_ERROR_ACCOUNT_NOT_ACTIVE or re.search(
            r"not active|locked|inactive|未激活|已锁定|停用", msg, re.I
        ):
            locked = True
        else:
            invalid = True
    return locked, invalid, first_message


def _is_success_url(url: str) -> bool:
    url_lower = url.lower()
    if "account.apple.com" not in url_lower:
        return False
    if re.search(r"signin|login|auth/authorize|idmsa", url_lower):
        return False
    return True


def _is_two_factor_page(url: str, text: str) -> bool:
    combined = (url + " " + text).lower()
    return bool(
        re.search(
            r"2fa|two.?factor|双重|验证|security code|验证码|密保|trusted phone|trust.*device",
            combined,
        )
    )


def _get_signin_complete_body_from_performance_log(driver: Any) -> Any:
    """
    Try to get signin/complete response body from Chrome performance log.
    Driver must support get_log("performance") (Chrome) and optionally execute_cdp_cmd.
    """
    try:
        logs = driver.get_log("performance")
    except Exception:
        return None
    target_url = APPLE_AUTH_SIGNIN_COMPLETE_URL
    request_ids: list[str] = []
    for entry in logs:
        try:
            msg = json.loads(entry.get("message", "{}"))
            method = msg.get("message", {}).get("method", "")
            params = msg.get("message", {}).get("params", {}) or {}
            if method == "Network.responseReceived":
                response = params.get("response", {}) or {}
                url = response.get("url", "")
                if target_url in url:
                    request_ids.append(params.get("requestId", ""))
        except (json.JSONDecodeError, TypeError, KeyError):
            continue
    if not request_ids:
        return None
    # Prefer last (most recent) response
    request_id = request_ids[-1]
    try:
        if hasattr(driver, "execute_cdp_cmd"):
            result = driver.execute_cdp_cmd("Network.getResponseBody", {"requestId": request_id})
            body_str = result.get("body", "")
            if result.get("base64Encoded"):
                import base64
                body_str = base64.b64decode(body_str).decode("utf-8", errors="replace")
            return json.loads(body_str) if body_str else None
    except Exception:
        pass
    return None


def perform_apple_login(
    driver: Any,
    account: str,
    password: str,
    log: Callable[[str, str], None] | None = None,
    timeout_ms: int = 90_000,
    skip_delays: bool = False,
) -> AppleLoginOutcome:
    """
    Perform Apple ID login on the given driver (Botasaurus Driver or Selenium-like).
    Result is driven by signin/complete response; fallback to URL/DOM on timeout.
    """
    def noop_log(_step: str, _msg: str) -> None:
        pass
    log_fn = log or noop_log

    goto_timeout_sec = max(timeout_ms / 1000, 50)
    step_sec = STEP_TIMEOUT_MS / 1000
    result_sec = RESULT_TIMEOUT_MS / 1000

    log_fn("LOGIN_START", f"步骤1: 打开登录页 {APPLE_ID_SIGN_IN_URL}")
    try:
        driver.get(APPLE_ID_SIGN_IN_URL)
        time.sleep(0.2 if not skip_delays else 0)
    except Exception as e:
        msg = str(e)
        log_fn("LOGIN_START", f"步骤1 失败: {msg[:120]}")
        return AppleLoginOutcome(
            success=False,
            error_code="TIMEOUT",
            error_message=f"打开登录页失败: {msg[:120]}",
        )

    time.sleep(min(step_sec, 3))
    try:
        driver.click("button.button.button-elevated", wait=step_sec)
    except Exception:
        try:
            el = driver.get_element_with_exact_text("Sign In", wait=5)
            if el and hasattr(el, "click"):
                el.click()
        except Exception:
            pass

    time.sleep(1.5 if not skip_delays else 0.5)

    scope = driver
    try:
        iframe = driver.get_iframe_by_link("idmsa.apple.com")
        if iframe:
            scope = iframe
    except Exception:
        pass

    account_selector = APPLE_ACCOUNT_INPUT
    password_selector = APPLE_PASSWORD_INPUT
    signin_selector = APPLE_SIGN_IN_BUTTON
    try:
        el = scope.select(account_selector, wait=STEP_TIMEOUT_MS / 1000)
        if not el:
            raise RuntimeError("Account input not found")
        el.type(account) if hasattr(el, "type") else scope.type(account_selector, account)
    except Exception:
        try:
            scope.wait_for_element(account_selector, wait=STEP_TIMEOUT_MS / 1000)
            scope.type(account_selector, account)
        except Exception:
            log_fn("LOGIN_START", "未找到账号框")
            return AppleLoginOutcome(success=False, error_code="TIMEOUT", error_message="登录表单未出现，账号输入框未找到")

    try:
        cont = scope.select("button", wait=2)
        if cont and hasattr(cont, "click"):
            cont.click()
    except Exception:
        pass
    time.sleep(1.5 if not skip_delays else 0.5)

    try:
        pw_el = scope.select(password_selector, wait=step_sec * 2)
        if pw_el and hasattr(pw_el, "type"):
            pw_el.type(password)
        else:
            scope.type(password_selector, password)
    except Exception:
        log_fn("LOGIN_START", "密码框未出现")
        return AppleLoginOutcome(success=False, error_code="TIMEOUT", error_message="密码框未出现")

    # Enable performance log for Network if using raw Chrome (Selenium)
    try:
        if hasattr(driver, "driver") and hasattr(driver.driver, "execute_cdp_cmd"):
            driver.driver.execute_cdp_cmd("Network.enable", {})
    except Exception:
        pass

    log_fn("LOGIN_START", f"步骤6: 点击登录并等待 signin/complete 响应（最多 {result_sec}s）")
    try:
        scope.click(signin_selector, wait=step_sec)
    except Exception:
        pass

    time.sleep(result_sec)
    signin_body: Any = None
    try:
        if hasattr(driver, "driver"):
            signin_body = _get_signin_complete_body_from_performance_log(driver.driver)
        else:
            signin_body = _get_signin_complete_body_from_performance_log(driver)
    except Exception:
        pass

    try:
        url = getattr(driver, "current_url", None) or (getattr(getattr(driver, "driver", None), "current_url", "") or "")
    except Exception:
        url = ""
    try:
        title = getattr(driver, "title", None) or (getattr(getattr(driver, "driver", None), "title", "") or "")
    except Exception:
        title = ""
    has_success_page = _is_success_url(url) or (title and APPLE_SUCCESS_TITLE_REGEX.search(title))
    try:
        if hasattr(driver, "select"):
            success_nav = driver.select(APPLE_SUCCESS_NAV_SELECTOR, wait=0.5)
            has_success_page = has_success_page or bool(success_nav)
    except Exception:
        pass

    if signin_body is not None:
        locked, invalid, first_message = _parse_service_errors(signin_body)
        if locked:
            return AppleLoginOutcome(
                success=False,
                error_code="ACCOUNT_LOCKED",
                error_message=first_message or "此账户已锁定",
            )
        if invalid:
            return AppleLoginOutcome(
                success=False,
                error_code="INVALID_CREDENTIALS",
                error_message=first_message or "请检查输入的账户信息并重试",
            )
        if _is_two_factor_page(url, title):
            return AppleLoginOutcome(success=True, two_factor_required=True)
        if has_success_page:
            return AppleLoginOutcome(success=True)
        return AppleLoginOutcome(success=True)

    # Fallback: no signin/complete response
    log_fn("LOGIN_START", "步骤7 兜底: 未收到 signin/complete 响应")
    if has_success_page:
        return AppleLoginOutcome(success=True)
    if _is_two_factor_page(url, title):
        return AppleLoginOutcome(success=True, two_factor_required=True)
    return AppleLoginOutcome(
        success=False,
        error_code="INVALID_CREDENTIALS",
        error_message="登录未完成或未收到登录接口响应",
    )
