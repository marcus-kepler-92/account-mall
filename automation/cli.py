"""
CLI entry: run status-test | run change-password | run change-region.
Input from --input file (CSV/JSON/text), output to stdout (JSONL) and/or --output file.
"""
import json
import sys
from pathlib import Path
from typing import Any

import typer
import yaml

from card_parser import parse_card_content
from config import get_headless, get_timeout_ms

app = typer.Typer(help="Apple ID local automation (status test, change password, change region).")
run_app = typer.Typer(help="Run a task type.")
app.add_typer(run_app, name="run")


def _load_config(config_path: str | None) -> dict[str, Any]:
    if not config_path:
        return {}
    path = Path(config_path)
    if not path.exists():
        typer.echo(f"Config file not found: {config_path}", err=True)
        raise typer.Exit(1)
    text = path.read_text(encoding="utf-8")
    if path.suffix in (".yaml", ".yml"):
        return yaml.safe_load(text) or {}
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        typer.echo(f"Invalid JSON config: {e}", err=True)
        raise typer.Exit(1)


def _read_input_items(input_path: str, delimiter: str) -> list[dict[str, Any]]:
    """Read .txt input: one card per line (newline separates cards); each line uses delimiter to split account/password."""
    path = Path(input_path)
    if not path.exists():
        typer.echo(f"Input file not found: {input_path}", err=True)
        raise typer.Exit(1)
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    # Try JSON array first
    if text.startswith("["):
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass
    items: list[dict[str, Any]] = []
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for line in lines:
        parsed = parse_card_content(line, delimiter=delimiter)
        if parsed:
            items.append(parsed.to_dict())
        else:
            # Try CSV header: account,password,region
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 2 and "@" in (parts[0] or ""):
                items.append({"account": parts[0], "password": parts[1], "region": (parts[2] if len(parts) > 2 else "未知")})
    return items


def _write_result_line(obj: dict[str, Any], output_path: str | None, fp: Any) -> None:
    line = json.dumps(obj, ensure_ascii=False) + "\n"
    sys.stdout.write(line)
    if output_path and fp:
        fp.write(line)


def _run_batch_with_browser(
    task_type: str,
    items: list[dict[str, Any]],
    delimiter: str,
    timeout_ms: int,
    headless: bool,
    config: dict[str, Any],
) -> list[dict[str, Any]]:
    from botasaurus.browser import browser

    results: list[dict[str, Any]] = []

    @browser(headless=headless)
    def _task(driver, data: dict[str, Any]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        task_type = data["task_type"]
        items = data["items"]
        delim = data.get("delimiter")
        timeout = data.get("timeout_ms", 90_000)
        skip_delays = bool(data.get("skip_delays"))
        cfg = data.get("config") or {}
        if task_type == "status-test":
            from runners.status_test import run_status_test
            for row in items:
                r = run_status_test(
                    driver, row.get("account", ""), row.get("password", ""),
                    delimiter=delim, timeout_ms=timeout, skip_delays=skip_delays,
                )
                r["account"] = row.get("account", "")
                out.append(r)
        elif task_type == "change-password":
            from runners.password_change import run_password_change
            pw_len = int(cfg.get("passwordLength", 14))
            for row in items:
                r = run_password_change(
                    driver, row.get("account", ""), row.get("password", ""),
                    delimiter=delim, password_length=pw_len, timeout_ms=timeout, skip_delays=skip_delays,
                )
                r["account"] = row.get("account", "")
                out.append(r)
        elif task_type == "change-region":
            from runners.change_region import run_change_region
            target = str(data.get("target_region", "US"))
            for row in items:
                r = run_change_region(
                    driver, row.get("account", ""), row.get("password", ""),
                    target_region=target, delimiter=delim, timeout_ms=timeout, skip_delays=skip_delays,
                )
                r["account"] = row.get("account", "")
                out.append(r)
        return out

    payload = {
        "task_type": task_type,
        "items": items,
        "delimiter": delimiter,
        "timeout_ms": timeout_ms,
        "skip_delays": config.get("skipDelays", False),
        "config": config,
    }
    if task_type == "change-region":
        payload["target_region"] = str(config.get("targetRegion", "US"))
    results = _task(payload)
    return results or []


@run_app.command("status-test")
def run_status_test(
    input_path: str = typer.Option(..., "--input", "-i", help="Input .txt file (one card per line)"),
    output_path: str | None = typer.Option(None, "--output", "-o", help="Optional output file (JSONL)"),
    delimiter: str = typer.Option(..., "--delimiter", "-d", help="行内卡密分隔符，必填。例如 ---- 或 :"),
    config_path: str | None = typer.Option(None, "--config", "-c", help="Optional YAML/JSON config file"),
    timeout_ms: int | None = typer.Option(None, "--timeout", help="Override timeout in ms"),
    headless: bool = typer.Option(False, "--headless", help="Run browser headless"),
) -> None:
    """Run status test for each account in the input file."""
    config = _load_config(config_path)
    items = _read_input_items(input_path, delimiter)
    if not items:
        typer.echo("No valid account lines in input file.", err=True)
        raise typer.Exit(1)
    timeout = timeout_ms if timeout_ms is not None else get_timeout_ms()
    headless = headless or get_headless()
    out_fp = open(output_path, "w", encoding="utf-8") if output_path else None
    try:
        results = _run_batch_with_browser("status-test", items, delimiter, timeout, headless, config)
        for r in results:
            _write_result_line(r, output_path, out_fp)
    finally:
        if out_fp:
            out_fp.close()


@run_app.command("change-password")
def run_change_password(
    input_path: str = typer.Option(..., "--input", "-i", help="Input .txt file (one card per line)"),
    output_path: str | None = typer.Option(None, "--output", "-o", help="Output file (JSONL)"),
    delimiter: str = typer.Option(..., "--delimiter", "-d", help="行内卡密分隔符，必填。例如 ---- 或 :"),
    config_path: str | None = typer.Option(None, "--config", "-c", help="Optional config file"),
    timeout_ms: int | None = typer.Option(None, "--timeout", help="Timeout in ms"),
    headless: bool = typer.Option(False, "--headless", help="Run headless"),
) -> None:
    """Change password for each account (generates new password per preset)."""
    config = _load_config(config_path)
    items = _read_input_items(input_path, delimiter)
    if not items:
        typer.echo("No valid account lines in input file.", err=True)
        raise typer.Exit(1)
    timeout = timeout_ms if timeout_ms is not None else get_timeout_ms()
    headless = headless or get_headless()
    out_fp = open(output_path, "w", encoding="utf-8") if output_path else None
    try:
        results = _run_batch_with_browser("change-password", items, delimiter, timeout, headless, config)
        for r in results:
            _write_result_line(r, output_path, out_fp)
    finally:
        if out_fp:
            out_fp.close()


@run_app.command("change-region")
def run_change_region(
    input_path: str = typer.Option(..., "--input", "-i", help="Input .txt file (one card per line)"),
    output_path: str | None = typer.Option(None, "--output", "-o", help="Output file (JSONL)"),
    delimiter: str = typer.Option(..., "--delimiter", "-d", help="行内卡密分隔符，必填。例如 ---- 或 :"),
    config_path: str | None = typer.Option(None, "--config", "-c", help="Optional config file"),
    target_region: str = typer.Option("US", "--region", "-r", help="Target region code (e.g. US)"),
    timeout_ms: int | None = typer.Option(None, "--timeout", help="Timeout in ms"),
    headless: bool = typer.Option(False, "--headless", help="Run headless"),
) -> None:
    """Change region for each account."""
    config = _load_config(config_path)
    config["targetRegion"] = target_region
    items = _read_input_items(input_path, delimiter)
    if not items:
        typer.echo("No valid account lines in input file.", err=True)
        raise typer.Exit(1)
    timeout = timeout_ms if timeout_ms is not None else get_timeout_ms()
    headless = headless or get_headless()
    out_fp = open(output_path, "w", encoding="utf-8") if output_path else None
    try:
        results = _run_batch_with_browser("change-region", items, delimiter, timeout, headless, config)
        for r in results:
            _write_result_line(r, output_path, out_fp)
    finally:
        if out_fp:
            out_fp.close()


def main() -> None:
    app()


if __name__ == "__main__":
    main()
