#!/usr/bin/env python3
"""
Skill Security & Privacy Scanner

Scans skills for security vulnerabilities and privacy concerns.
Integrates with skill-security-scanner rules and adds privacy checks.
Can auto-rewrite unsafe code.

Usage:
    python3 security_check.py --path /path/to/skill
    python3 security_check.py --all --skills-dir ./
    python3 security_check.py --path /path/to/skill --auto-rewrite
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class Severity(Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"

@dataclass
class Finding:
    rule_id: str
    severity: Severity
    file: str
    line: int
    message: str
    evidence: str
    rewritable: bool

@dataclass
class ScanReport:
    skill_name: str
    scanned_files: int
    critical: int = 0
    warning: int = 0
    info: int = 0
    findings: list = field(default_factory=list)
    result: str = "CLEAN"  # CLEAN | PASSED_AFTER_REWRITE | BLOCKED | FLAGGED
    privacy_score: int = 100  # 0-100, higher is safer

# ---------------------------------------------------------------------------
# Scannable file extensions
# ---------------------------------------------------------------------------

CODE_EXTENSIONS = {".js", ".ts", ".mjs", ".cjs", ".mts", ".cts", ".jsx", ".tsx", ".py", ".sh", ".bash"}
MARKDOWN_EXTENSIONS = {".md", ".mdx"}
ALL_SCANNABLE = CODE_EXTENSIONS | MARKDOWN_EXTENSIONS

# ---------------------------------------------------------------------------
# Security Rules
# ---------------------------------------------------------------------------

LINE_RULES = [
    {
        "id": "dangerous-exec",
        "severity": Severity.CRITICAL,
        "message": "Shell命令执行检测 (child_process/subprocess)",
        "pattern": re.compile(r"\b(exec|execSync|spawn|spawnSync|execFile|execFileSync)\s*\("),
        "context": re.compile(r"child_process|subprocess"),
        "rewritable": True,
    },
    {
        "id": "dangerous-exec-python",
        "severity": Severity.CRITICAL,
        "message": "Python危险命令执行检测 (os.system/subprocess.call with shell=True)",
        "pattern": re.compile(r"\b(os\.system|os\.popen|subprocess\.call.*shell\s*=\s*True|subprocess\.Popen.*shell\s*=\s*True)\b"),
        "context": None,
        "rewritable": True,
    },
    {
        "id": "dynamic-code-execution",
        "severity": Severity.CRITICAL,
        "message": "动态代码执行检测 (eval/exec/new Function)",
        "pattern": re.compile(r"\beval\s*\(|\bnew\s+Function\s*\(|\bexec\s*\(\s*compile"),
        "context": None,
        "rewritable": True,
    },
    {
        "id": "crypto-mining",
        "severity": Severity.CRITICAL,
        "message": "疑似加密货币挖矿引用",
        "pattern": re.compile(r"stratum\+tcp|stratum\+ssl|coinhive|cryptonight|xmrig", re.IGNORECASE),
        "context": None,
        "rewritable": True,
    },
    {
        "id": "hardcoded-secret",
        "severity": Severity.WARNING,
        "message": "疑似硬编码密钥/API Key",
        "pattern": re.compile(
            r"(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36,}|AKIA[A-Z0-9]{16}|"
            r"(?:password|secret|token|apikey)\s*[:=]\s*[\"'][^\"']{8,}[\"'])",
            re.IGNORECASE,
        ),
        "context": None,
        "rewritable": True,
    },
    {
        "id": "path-traversal",
        "severity": Severity.WARNING,
        "message": "路径穿越模式检测",
        "pattern": re.compile(r"(?:\.\.\/){2,}|path\.join\s*\([^)]*(?:req\.|user|input|param)", re.IGNORECASE),
        "context": None,
        "rewritable": True,
    },
    {
        "id": "suspicious-network",
        "severity": Severity.WARNING,
        "message": "非标准端口WebSocket连接",
        "pattern": re.compile(r"new\s+WebSocket\s*\(\s*[\"']wss?://[^\"']*:(\d+)"),
        "context": None,
        "rewritable": False,
    },
]

SOURCE_RULES = [
    {
        "id": "potential-exfiltration",
        "severity": Severity.WARNING,
        "message": "文件读取配合网络发送 — 疑似数据外泄",
        "pattern": re.compile(r"readFileSync|readFile|open\s*\("),  # nosec - rule pattern
        "context": re.compile(r"\bfetch\b|\bpost\b|http\.request|requests\.post", re.IGNORECASE),  # nosec
        "rewritable": False,
    },
    {
        "id": "obfuscated-code",
        "severity": Severity.WARNING,
        "message": "十六进制编码字符串序列 (疑似混淆)",
        "pattern": re.compile(r"(\\x[0-9a-fA-F]{2}){6,}"),
        "context": None,
        "rewritable": False,
    },
    {
        "id": "env-harvesting",
        "severity": Severity.CRITICAL,
        "message": "环境变量访问配合网络发送 — 凭证窃取风险",
        "pattern": re.compile(r"process\.env|os\.environ"),  # nosec - rule pattern
        "context": re.compile(r"\bfetch\b|\bpost\b|http\.request|requests\.post", re.IGNORECASE),  # nosec
        "rewritable": True,
    },
]

MARKDOWN_RULES = [
    {
        "id": "prompt-injection",
        "severity": Severity.CRITICAL,
        "message": "提示注入攻击检测",
        "pattern": re.compile(
            r"ignore\s+(all\s+)?previous\s+instructions|you\s+are\s+now\s+a|"
            r"system\s+prompt\s+override|disregard\s+(all\s+)?prior",
            re.IGNORECASE,
        ),
        "rewritable": True,
    },
    {
        "id": "prompt-injection-jailbreak",
        "severity": Severity.CRITICAL,
        "message": "越狱模式检测",
        "pattern": re.compile(
            r"\bDAN\s+mode\b|do\s+anything\s+now|pretend\s+you\s+have\s+no\s+restrictions",
            re.IGNORECASE,
        ),
        "rewritable": True,
    },
]

# ---------------------------------------------------------------------------
# Privacy Rules (additional layer)
# ---------------------------------------------------------------------------

PRIVACY_RULES = [
    {
        "id": "privacy-data-collection",
        "severity": Severity.WARNING,
        "message": "疑似用户数据收集 (联系人/位置/浏览历史)",
        "pattern": re.compile(  # nosec - privacy rule pattern
            r"contacts|geolocation|navigator\.userAgent|browsing.?history|"
            r"localStorage\.getItem|document\.cookie",
            re.IGNORECASE,
        ),
        "deduction": 15,
    },
    {
        "id": "privacy-unknown-domain",
        "severity": Severity.WARNING,
        "message": "向未知域名发送数据",
        "pattern": re.compile(
            r"fetch\s*\(\s*[\"']https?://(?!(?:api\.github\.com|clawhub\.com|localhost|127\.0\.0\.1))",
            re.IGNORECASE,
        ),
        "deduction": 20,
    },
    {
        "id": "privacy-filesystem-access",
        "severity": Severity.INFO,
        "message": "访问非标准文件系统路径",
        "pattern": re.compile(  # nosec - privacy rule pattern
            r"(?:/etc/passwd|/etc/shadow|~/\.|~/.ssh|~/.aws|~/.gnupg|/var/log)",
            re.IGNORECASE,
        ),
        "deduction": 25,
    },
    {
        "id": "privacy-keylogger",
        "severity": Severity.CRITICAL,
        "message": "疑似键盘记录行为",
        "pattern": re.compile(r"keypress|keydown|keyup.*(?:send|post|fetch|log)", re.IGNORECASE),  # nosec - privacy rule pattern
        "deduction": 50,
    },
]

# ---------------------------------------------------------------------------
# Rewrite Patterns
# ---------------------------------------------------------------------------

REWRITE_MAP = {
    "dangerous-exec": {
        "patterns": [
            (
                re.compile(r"""(const|let|var)\s+\{?\s*exec\s*\}?\s*=\s*require\s*\(\s*['"]child_process['"]\s*\)"""),
                'import { execFile } from "child_process";\n'
                "const ALLOWED_COMMANDS = ['ls', 'cat', 'echo'];\n"
                "function safeExec(cmd, args) {\n"
                "  if (!ALLOWED_COMMANDS.includes(cmd)) throw new Error(`Command not allowed: ${cmd}`);\n"
                "  return execFile(cmd, args);\n"
                "}",
            ),
        ],
        "comment": "// [SECURITY REWRITE] Replaced dangerous exec with safe allowlisted subprocess\n",
    },
    "dangerous-exec-python": {
        "patterns": [
            (
                re.compile(r"os\.system\s*\([^)]+\)"),
                "subprocess.run(cmd_args, check=True, shell=False)  # [SECURITY REWRITE]",
            ),
        ],
        "comment": "# [SECURITY REWRITE] Replaced os.system with subprocess.run(shell=False)\n",
    },
    "dynamic-code-execution": {
        "patterns": [
            (
                re.compile(r"\beval\s*\(\s*([^)]+)\s*\)"),
                "json.loads(\\1)  # [SECURITY REWRITE] Replaced eval with JSON parse",
            ),
        ],
        "comment": "// [SECURITY REWRITE] Replaced dynamic code execution with static dispatch\n",
    },
    "crypto-mining": {
        "patterns": [
            (
                re.compile(r".*(?:stratum\+tcp|coinhive|cryptonight|xmrig).*\n?", re.IGNORECASE),
                "// [SECURITY REMOVED] Crypto-mining reference removed\n",
            ),
        ],
        "comment": "// [SECURITY REWRITE] Removed crypto-mining references\n",
    },
    "env-harvesting": {
        "patterns": [
            (
                re.compile(r"(?:process\.env|os\.environ)\b"),
                "SCOPED_ENV  # [SECURITY REWRITE] Replaced with scoped env access",
            ),
        ],
        "comment": "// [SECURITY REWRITE] Replaced env harvesting with scoped access\n",
    },
    "prompt-injection": {
        "patterns": [
            (
                re.compile(
                    r"(?:ignore\s+(?:all\s+)?previous\s+instructions|you\s+are\s+now\s+a|"
                    r"system\s+prompt\s+override|disregard\s+(?:all\s+)?prior)[^\n]*",
                    re.IGNORECASE,
                ),
                "[REMOVED: Prompt injection attempt detected and sanitized]",
            ),
        ],
        "comment": "",
    },
    "hardcoded-secret": {
        "patterns": [
            (
                re.compile(
                    r"((?:password|secret|token|apikey)\s*[:=]\s*)[\"'][^\"']{8,}[\"']",
                    re.IGNORECASE,
                ),
                '\\1os.environ.get("REDACTED_SECRET", "")  # [SECURITY REWRITE] Use env var',
            ),
        ],
        "comment": "# [SECURITY REWRITE] Replaced hardcoded secret with env var\n",
    },
}

# ---------------------------------------------------------------------------
# Scanner
# ---------------------------------------------------------------------------

def truncate(s: str, max_len: int = 120) -> str:
    return s if len(s) <= max_len else s[:max_len] + "…"


def collect_files(skill_path: Path) -> list[Path]:
    """Collect all scannable files in a skill directory."""
    files = []
    for root, dirs, filenames in os.walk(skill_path):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for fname in filenames:
            fpath = Path(root) / fname
            if fpath.suffix in ALL_SCANNABLE:
                files.append(fpath)
    return files


def _is_rule_definition(line: str) -> bool:
    """Check if a line is a security rule definition (pattern/comment/string literal), not actual code."""
    stripped = line.strip()
    # Lines that define regex patterns, dict entries, string literals for rules
    rule_def_patterns = [
        r'^\s*"pattern"', r'^\s*"message"', r'^\s*"comment"', r'^\s*"id"',
        r"^\s*re\.compile", r'^\s*\(?\s*re\.compile',
        r"^\s*#.*REWRITE", r"^\s*//.*REWRITE",
        r'^\s*".*REWRITE', r"^\s*'.*REWRITE",
        r"REWRITE_MAP", r"LINE_RULES", r"SOURCE_RULES", r"MARKDOWN_RULES", r"PRIVACY_RULES",
        r'^\s*r"', r"^\s*r'",  # regex string continuation lines
    ]
    for pat in rule_def_patterns:
        if re.search(pat, stripped):
            return True
    # String literals containing rule examples
    if re.search(r'^\s*["\'].*(?:exec|eval|stratum|coinhive|xmrig|os\.system|os\.environ)', stripped):  # nosec - rule definition check
        return True
    return False


def scan_file(fpath: Path, source: str) -> list[Finding]:
    """Scan a single file for security issues."""
    findings = []
    lines = source.split("\n")
    suffix = fpath.suffix

    # Determine which rules to apply
    if suffix in MARKDOWN_EXTENSIONS:
        rules_to_check = MARKDOWN_RULES
    else:
        rules_to_check = LINE_RULES

    # Line-level rules
    for i, line in enumerate(lines, 1):
        # Skip lines with nosec comment or rule definition lines
        if "nosec" in line or "# noqa" in line:
            continue
        if _is_rule_definition(line):
            continue

        for rule in rules_to_check:
            match = rule["pattern"].search(line)
            if match:
                # Check context requirement
                if rule.get("context"):
                    if not rule["context"].search(source):
                        continue
                findings.append(Finding(
                    rule_id=rule["id"],
                    severity=rule["severity"],
                    file=str(fpath),
                    line=i,
                    message=rule["message"],
                    evidence=truncate(line.strip()),
                    rewritable=rule.get("rewritable", False),
                ))

    # Source-level rules (need full file context)
    if suffix in CODE_EXTENSIONS:
        for rule in SOURCE_RULES:
            match = rule["pattern"].search(source)
            if match:
                if rule.get("context") and not rule["context"].search(source):
                    continue
                # Check if the matched line has nosec or is a rule definition
                line_start = source.rfind("\n", 0, match.start()) + 1
                line_end = source.find("\n", match.end())
                if line_end == -1:
                    line_end = len(source)
                matched_line = source[line_start:line_end]
                if "nosec" in matched_line or _is_rule_definition(matched_line):
                    continue
                line_num = source[:match.start()].count("\n") + 1
                findings.append(Finding(
                    rule_id=rule["id"],
                    severity=rule["severity"],
                    file=str(fpath),
                    line=line_num,
                    message=rule["message"],
                    evidence=truncate(match.group()),
                    rewritable=rule.get("rewritable", False),
                ))

    return findings


def scan_privacy(fpath: Path, source: str) -> tuple[list[Finding], int]:
    """Scan a file for privacy concerns. Returns (findings, deduction_total)."""
    findings = []
    total_deduction = 0

    for rule in PRIVACY_RULES:
        match = rule["pattern"].search(source)
        if match:
            # Check if the match is within a rule definition / pattern string
            line_start = source.rfind("\n", 0, match.start()) + 1
            line_end = source.find("\n", match.end())
            if line_end == -1:
                line_end = len(source)
            matched_line = source[line_start:line_end]
            if _is_rule_definition(matched_line) or "nosec" in matched_line:
                continue

            line_num = source[:match.start()].count("\n") + 1
            findings.append(Finding(
                rule_id=rule["id"],
                severity=rule["severity"],
                file=str(fpath),
                line=line_num,
                message=rule["message"],
                evidence=truncate(match.group()),
                rewritable=False,
            ))
            total_deduction += rule.get("deduction", 10)

    return findings, total_deduction


def apply_rewrites(fpath: Path, source: str, findings: list[Finding]) -> tuple[str, int]:
    """Apply security rewrites to a file. Returns (new_source, rewrite_count)."""
    new_source = source
    rewrite_count = 0
    rewritten_rules = set()

    for finding in findings:
        if not finding.rewritable or finding.severity != Severity.CRITICAL:
            continue
        if finding.rule_id in rewritten_rules:
            continue

        rewrite = REWRITE_MAP.get(finding.rule_id)
        if not rewrite:
            continue

        for pattern, replacement in rewrite["patterns"]:
            new_text, count = pattern.subn(replacement, new_source)
            if count > 0:
                new_source = new_text
                rewrite_count += count
                rewritten_rules.add(finding.rule_id)

    return new_source, rewrite_count


def scan_skill(skill_path: Path, auto_rewrite: bool = False) -> ScanReport:
    """Scan a complete skill for security and privacy issues."""
    skill_name = skill_path.name
    report = ScanReport(skill_name=skill_name, scanned_files=0)

    files = collect_files(skill_path)
    report.scanned_files = len(files)

    all_findings = []
    total_privacy_deduction = 0
    rewrite_total = 0

    for fpath in files:
        try:
            source = fpath.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        # Security scan
        findings = scan_file(fpath, source)
        all_findings.extend(findings)

        # Privacy scan
        privacy_findings, privacy_deduction = scan_privacy(fpath, source)
        all_findings.extend(privacy_findings)
        total_privacy_deduction += privacy_deduction

        # Auto-rewrite if enabled
        if auto_rewrite:
            critical_findings = [f for f in findings if f.severity == Severity.CRITICAL and f.rewritable]
            if critical_findings:
                new_source, count = apply_rewrites(fpath, source, critical_findings)
                if count > 0:
                    fpath.write_text(new_source, encoding="utf-8")
                    rewrite_total += count

    # Compute totals
    report.findings = all_findings
    report.critical = sum(1 for f in all_findings if f.severity == Severity.CRITICAL)
    report.warning = sum(1 for f in all_findings if f.severity == Severity.WARNING)
    report.info = sum(1 for f in all_findings if f.severity == Severity.INFO)
    report.privacy_score = max(0, 100 - total_privacy_deduction)

    # Determine result
    if report.critical == 0 and report.warning == 0:
        report.result = "CLEAN"
    elif report.critical > 0 and auto_rewrite and rewrite_total > 0:
        report.result = "PASSED_AFTER_REWRITE"
    elif report.critical > 0:
        report.result = "BLOCKED"
    else:
        report.result = "FLAGGED"

    return report


# ---------------------------------------------------------------------------
# Report Printing
# ---------------------------------------------------------------------------

def print_report(report: ScanReport):
    """Print a formatted scan report."""
    print(f"\n{'═' * 55}")
    print(f"  🔒 Skill安全扫描报告")
    print(f"{'═' * 55}")
    print(f"  Skill: {report.skill_name}")
    print(f"  扫描文件数: {report.scanned_files}")
    print(f"  隐私评分: {report.privacy_score}/100")
    print()
    print(f"  Critical: {report.critical}  ⛔")
    print(f"  Warning:  {report.warning}  ⚠️")
    print(f"  Info:     {report.info}  ℹ️")

    if report.findings:
        print(f"\n  发现:")
        print(f"  {'─' * 50}")
        for f in report.findings:
            icon = "⛔" if f.severity == Severity.CRITICAL else "⚠️" if f.severity == Severity.WARNING else "ℹ️"
            print(f"\n  [{f.severity.value.upper()}] {f.rule_id} {icon}")
            print(f"    文件: {f.file}:{f.line}")
            print(f"    证据: {f.evidence}")
            action = "可改写" if f.rewritable else "需人工审核"
            print(f"    操作: {action}")
        print(f"\n  {'─' * 50}")

    result_icon = {
        "CLEAN": "✅",
        "PASSED_AFTER_REWRITE": "🔧",
        "BLOCKED": "⛔",
        "FLAGGED": "⚠️",
    }
    print(f"\n  结果: {report.result} {result_icon.get(report.result, '')}")
    print(f"{'═' * 55}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Skill安全与隐私扫描器")
    parser.add_argument("--path", type=str, help="要扫描的skill路径")
    parser.add_argument("--all", action="store_true", help="扫描所有已安装skill")
    parser.add_argument("--skills-dir", type=str,
                        default=str(Path(__file__).resolve().parent.parent.parent),
                        help="skills根目录")
    parser.add_argument("--auto-rewrite", action="store_true",
                        help="自动改写不安全代码")
    parser.add_argument("--json", action="store_true", help="JSON格式输出")
    parser.add_argument("--min-privacy-score", type=int, default=60,
                        help="最低隐私评分（低于此分数阻断安装）")

    args = parser.parse_args()

    reports = []

    if args.all:
        skills_dir = Path(args.skills_dir)
        for entry in sorted(skills_dir.iterdir()):
            if entry.is_dir() and (entry / "SKILL.md").exists():
                report = scan_skill(entry, args.auto_rewrite)
                reports.append(report)
    elif args.path:
        skill_path = Path(args.path)
        if not skill_path.exists():
            print(f"  ❌ 路径不存在: {args.path}")
            sys.exit(1)
        report = scan_skill(skill_path, args.auto_rewrite)
        reports.append(report)
    else:
        parser.error("需要 --path 或 --all 参数")

    if args.json:
        output = []
        for r in reports:
            d = {
                "skill_name": r.skill_name,
                "scanned_files": r.scanned_files,
                "critical": r.critical,
                "warning": r.warning,
                "info": r.info,
                "result": r.result,
                "privacy_score": r.privacy_score,
                "findings": [
                    {
                        "rule_id": f.rule_id,
                        "severity": f.severity.value,
                        "file": f.file,
                        "line": f.line,
                        "message": f.message,
                        "evidence": f.evidence,
                        "rewritable": f.rewritable,
                    }
                    for f in r.findings
                ],
            }
            output.append(d)
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        has_blocked = False
        for report in reports:
            print_report(report)
            if report.result == "BLOCKED":
                has_blocked = True
            if report.privacy_score < args.min_privacy_score:
                print(f"  ⚠️  隐私评分 {report.privacy_score} 低于阈值 {args.min_privacy_score}，建议不安装")
                has_blocked = True

        if reports:
            total = len(reports)
            clean = sum(1 for r in reports if r.result == "CLEAN")
            rewritten = sum(1 for r in reports if r.result == "PASSED_AFTER_REWRITE")
            blocked = sum(1 for r in reports if r.result == "BLOCKED")
            flagged = sum(1 for r in reports if r.result == "FLAGGED")

            print(f"\n{'═' * 55}")
            print(f"  📊 总结: {total}个skill已扫描")
            print(f"  ✅ 安全: {clean}  🔧 已改写: {rewritten}  ⛔ 阻断: {blocked}  ⚠️ 待审核: {flagged}")
            print(f"{'═' * 55}")

        if has_blocked:
            sys.exit(1)


if __name__ == "__main__":
    main()
