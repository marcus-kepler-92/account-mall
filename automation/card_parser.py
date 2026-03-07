"""
Parse card/account content: JSON, delimiter-separated, or label-prefixed.
Matches logic in lib/free-shared-card.ts (parseCardContentWithDelimiter).
"""
import json
import re
from dataclasses import dataclass
from typing import Any

FALLBACK_DELIMITERS = ["----", ":", "|"]
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+$")
DATE_REGEX = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$|^\d{4}-\d{2}-\d{2}$")

LABEL_PREFIXES: list[tuple[str, str]] = [
    ("密保答案朋友答案", "securityAnswerFriend"),
    ("朋友答案", "securityAnswerFriend"),
    ("工作答案", "securityAnswerWork"),
    ("父母答案", "securityAnswerParents"),
    ("账号", "account"),
    ("密码", "password"),
    ("生日", "birthday"),
    ("account", "account"),
    ("password", "password"),
    ("birthday", "birthday"),
]


@dataclass
class CardPayload:
    account: str
    password: str
    region: str = "未知"
    birthday: str | None = None
    security_answer_friend: str | None = None
    security_answer_work: str | None = None
    security_answer_parents: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"account": self.account, "password": self.password, "region": self.region}
        if self.birthday:
            d["birthday"] = self.birthday
        if self.security_answer_friend:
            d["securityAnswerFriend"] = self.security_answer_friend
        if self.security_answer_work:
            d["securityAnswerWork"] = self.security_answer_work
        if self.security_answer_parents:
            d["securityAnswerParents"] = self.security_answer_parents
        return d


def parse_free_shared_json(content: str) -> CardPayload | None:
    content = content.strip()
    if not content:
        return None
    try:
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            return None
        acc = parsed.get("account")
        pwd = parsed.get("password")
        if not isinstance(acc, str) or not isinstance(pwd, str):
            return None
        return CardPayload(
            account=acc,
            password=pwd,
            region=parsed.get("region") or "未知",
            birthday=parsed.get("birthday"),
            security_answer_friend=parsed.get("securityAnswerFriend"),
            security_answer_work=parsed.get("securityAnswerWork"),
            security_answer_parents=parsed.get("securityAnswerParents"),
        )
    except (json.JSONDecodeError, TypeError):
        return None


def _parse_by_label(parts: list[str]) -> CardPayload | None:
    acc: dict[str, str] = {"region": "未知"}
    for part in parts:
        part = part.strip()
        if not part:
            continue
        for prefix, key in LABEL_PREFIXES:
            if part.startswith(prefix):
                val = part[len(prefix) :].strip()
                if val:
                    acc[key] = val
                break
    if "account" not in acc or "password" not in acc:
        return None
    return CardPayload(
        account=acc["account"],
        password=acc["password"],
        region=acc.get("region", "未知"),
        birthday=acc.get("birthday"),
        security_answer_friend=acc.get("securityAnswerFriend"),
        security_answer_work=acc.get("securityAnswerWork"),
        security_answer_parents=acc.get("securityAnswerParents"),
    )


def _parse_by_heuristic(parts: list[str]) -> CardPayload | None:
    if len(parts) < 2:
        return None
    account: str | None = None
    password: str | None = None
    region = "未知"
    birthday: str | None = None
    used: set[int] = set()

    for i, p in enumerate(parts):
        if EMAIL_REGEX.match(p.strip()):
            account = parts[i].strip()
            used.add(i)
            if i + 1 < len(parts):
                password = parts[i + 1].strip()
                used.add(i + 1)
            break
    if not account or not password:
        account = parts[0].strip() if parts[0] else None
        password = parts[1].strip() if len(parts) > 1 and parts[1] else None
        used.add(0)
        used.add(1)
    for i, p in enumerate(parts):
        if i not in used and DATE_REGEX.match(p.strip()):
            birthday = parts[i].strip()
            used.add(i)
            break
    third = parts[2].strip() if len(parts) > 2 else None
    if third and 2 not in used and not (birthday and third == birthday):
        region = third
        used.add(2)

    if not account or not password:
        return None
    return CardPayload(
        account=account,
        password=password,
        region=region,
        birthday=birthday,
    )


def parse_card_content(content: str, delimiter: str | None = None) -> CardPayload | None:
    """
    Parse card content: try JSON first, then delimiter-separated (with label or heuristic).
    delimiter: if set, use only this delimiter; else try FALLBACK_DELIMITERS then whitespace.
    """
    content = content.strip()
    if not content:
        return None
    out = parse_free_shared_json(content)
    if out is not None:
        return out
    delimiters = [delimiter] if (delimiter and delimiter.strip()) else FALLBACK_DELIMITERS
    parts: list[str] = []
    for sep in delimiters:
        p = [s.strip() for s in content.split(sep) if s.strip()]
        if len(p) >= 2:
            parts = p
            break
    if len(parts) < 2:
        parts = [s for s in content.split() if s]
    if len(parts) < 2:
        return None
    out = _parse_by_label(parts)
    if out is not None:
        return out
    return _parse_by_heuristic(parts)
