#!/usr/bin/env python3
"""
Skill Manager — Core management operations.

Handles listing, updating, self-iteration, and lifecycle management
of clawbot skills.

Usage:
    python3 manage_skills.py list [--json]
    python3 manage_skills.py info --skill <name>
    python3 manage_skills.py update --skill <name>
    python3 manage_skills.py update --all
    python3 manage_skills.py self-update
    python3 manage_skills.py remove --skill <name>
    python3 manage_skills.py changelog --skill <name>
    python3 manage_skills.py scan-all
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SKILLS_DIR = Path(__file__).resolve().parent.parent.parent
SELF_DIR = Path(__file__).resolve().parent.parent  # skill-manager/
CHANGELOG_FILE = SELF_DIR / ".changelog.json"

# ---------------------------------------------------------------------------
# Skill Info Parsing
# ---------------------------------------------------------------------------

def parse_skill_md(skill_path: Path) -> dict:
    """Parse SKILL.md frontmatter and extract metadata."""
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return {}

    try:
        content = skill_md.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return {}

    info = {
        "name": skill_path.name,
        "path": str(skill_path),
        "description": "",
        "has_scripts": (skill_path / "scripts").exists(),
        "has_references": (skill_path / "references").exists(),
        "has_assets": (skill_path / "assets").exists(),
        "file_count": sum(1 for _ in skill_path.rglob("*") if _.is_file()),
    }

    # Parse YAML frontmatter
    fm_match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if fm_match:
        fm_text = fm_match.group(1)
        # Extract name
        name_match = re.search(r"^name:\s*(.+)$", fm_text, re.MULTILINE)
        if name_match:
            info["name"] = name_match.group(1).strip().strip("\"'")

        # Extract description
        desc_match = re.search(r"^description:\s*(.+?)$", fm_text, re.MULTILINE)
        if desc_match:
            desc = desc_match.group(1).strip().strip("\"'")
            # Handle multi-line descriptions
            if not desc:
                # Try to find indented continuation
                lines = fm_text.split("\n")
                for i, line in enumerate(lines):
                    if line.strip().startswith("description:"):
                        desc_parts = []
                        for j in range(i + 1, len(lines)):
                            if lines[j].startswith("  ") or lines[j].startswith("\t"):
                                desc_parts.append(lines[j].strip())
                            else:
                                break
                        desc = " ".join(desc_parts)
                        break
            info["description"] = desc

    # Count lines
    info["lines"] = content.count("\n") + 1

    return info


def list_skills(skills_dir: Path = SKILLS_DIR) -> list[dict]:
    """List all installed skills with their metadata."""
    skills = []
    for entry in sorted(skills_dir.iterdir()):
        if entry.is_dir() and (entry / "SKILL.md").exists():
            info = parse_skill_md(entry)
            if info:
                skills.append(info)
    return skills


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_list(args):
    """List all skills."""
    skills = list_skills()

    if args.json:
        print(json.dumps(skills, ensure_ascii=False, indent=2))
        return

    print(f"\n{'═' * 65}")
    print(f"  📦 已安装的Skills — 共 {len(skills)} 个")
    print(f"{'═' * 65}")

    for s in skills:
        resources = []
        if s.get("has_scripts"):
            resources.append("📜scripts")
        if s.get("has_references"):
            resources.append("📄refs")
        if s.get("has_assets"):
            resources.append("🎨assets")
        res_str = " | ".join(resources) if resources else "无资源"

        desc = s.get("description", "无描述")
        if len(desc) > 60:
            desc = desc[:57] + "..."

        print(f"\n  📦 {s['name']}")
        print(f"     {desc}")
        print(f"     [{res_str}] | {s.get('file_count', 0)}文件 | {s.get('lines', 0)}行")

    print(f"\n{'═' * 65}")


def cmd_info(args):
    """Show detailed info about a skill."""
    skill_path = SKILLS_DIR / args.skill
    if not skill_path.exists():
        print(f"  ❌ Skill不存在: {args.skill}")
        sys.exit(1)

    info = parse_skill_md(skill_path)
    if args.json:
        print(json.dumps(info, ensure_ascii=False, indent=2))
        return

    print(f"\n{'═' * 55}")
    print(f"  📦 Skill详情: {info['name']}")
    print(f"{'═' * 55}")
    print(f"  描述: {info.get('description', '无')}")
    print(f"  路径: {info.get('path', '无')}")
    print(f"  文件数: {info.get('file_count', 0)}")
    print(f"  行数: {info.get('lines', 0)}")
    print(f"  Scripts: {'✅' if info.get('has_scripts') else '❌'}")
    print(f"  References: {'✅' if info.get('has_references') else '❌'}")
    print(f"  Assets: {'✅' if info.get('has_assets') else '❌'}")

    # List files
    print(f"\n  文件列表:")
    for fpath in sorted(skill_path.rglob("*")):
        if fpath.is_file():
            rel = fpath.relative_to(skill_path)
            print(f"    {rel}")

    print(f"\n{'═' * 55}")


def cmd_update(args):
    """Update skills via clawhub or self-iteration."""
    if args.all:
        skills = list_skills()
        for s in skills:
            _update_single_skill(s["name"])
    elif args.skill:
        _update_single_skill(args.skill)
    else:
        print("  ❌ 需要 --skill 或 --all 参数")
        sys.exit(1)


def _update_single_skill(skill_name: str):
    """Update a single skill."""
    skill_path = SKILLS_DIR / skill_name

    if not skill_path.exists():
        print(f"  ❌ Skill不存在: {skill_name}")
        return

    print(f"\n  🔄 更新 {skill_name}...")

    # Try clawhub update first
    if shutil.which("clawhub"):
        result = subprocess.run(
            ["clawhub", "update", skill_name, "--dir", str(SKILLS_DIR)],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            print(f"  ✅ 已通过ClawHub更新: {skill_name}")
            _log_changelog(skill_name, "clawhub_update", result.stdout[:200])

            # Re-scan after update
            _rescan_skill(skill_path)
            return

    print(f"  ℹ️  ClawHub更新不可用，skill保持当前版本")
    print(f"  💡 可以手动编辑 {skill_path}/SKILL.md 进行迭代更新")


def cmd_self_update(args):
    """Self-update the skill-manager itself."""
    print(f"\n  🔄 自迭代更新 skill-manager...")

    # Check if clawhub has a newer version
    if shutil.which("clawhub"):
        result = subprocess.run(
            ["clawhub", "update", "skill-manager", "--dir", str(SKILLS_DIR)],
            capture_output=True, text=True,
        )
        if result.returncode == 0 and "already up to date" not in result.stdout.lower():
            print(f"  ✅ skill-manager已通过ClawHub更新")
            _log_changelog("skill-manager", "self_update_clawhub", result.stdout[:200])
            return

    # Self-analysis: check for improvements
    print(f"  📊 分析当前skill-manager状态...")
    skill_info = parse_skill_md(SELF_DIR)
    print(f"  • 当前 SKILL.md: {skill_info.get('lines', 0)} 行")
    print(f"  • 文件数: {skill_info.get('file_count', 0)}")
    print(f"  • Scripts: {skill_info.get('has_scripts', False)}")

    # Run security scan on self
    _rescan_skill(SELF_DIR)

    _log_changelog("skill-manager", "self_check", "Self-analysis completed")
    print(f"\n  ✅ 自检完成。如需更新，请手动编辑或通过对话指示改进方向")


def cmd_remove(args):
    """Remove a skill."""
    skill_path = SKILLS_DIR / args.skill

    if not skill_path.exists():
        print(f"  ❌ Skill不存在: {args.skill}")
        sys.exit(1)

    if args.skill == "skill-manager":
        print(f"  ❌ 不能删除skill-manager自身")
        sys.exit(1)

    # Backup before removal
    backup_dir = SKILLS_DIR / ".skill-backups"
    backup_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"{args.skill}_{timestamp}"
    shutil.copytree(skill_path, backup_path)
    print(f"  💾 已备份到: {backup_path}")

    shutil.rmtree(skill_path)
    _log_changelog(args.skill, "removed", f"Backed up to {backup_path}")
    print(f"  ✅ 已删除: {args.skill}")


def cmd_changelog(args):
    """Show changelog for a skill."""
    if not CHANGELOG_FILE.exists():
        print(f"  ℹ️  暂无变更记录")
        return

    changelog = json.loads(CHANGELOG_FILE.read_text())
    entries = changelog.get(args.skill, []) if args.skill else []

    if not entries and args.skill:
        # Show all changelogs
        entries = []
        for name, items in changelog.items():
            for item in items:
                item["skill"] = name
                entries.append(item)

    if args.json:
        print(json.dumps(entries, ensure_ascii=False, indent=2))
        return

    if not entries:
        print(f"  ℹ️  暂无变更记录")
        return

    print(f"\n{'═' * 55}")
    print(f"  📋 变更记录 {f'— {args.skill}' if args.skill else ''}")
    print(f"{'═' * 55}")
    for e in entries[-20:]:  # Last 20 entries
        skill_label = f" [{e['skill']}]" if "skill" in e else ""
        print(f"  {e.get('timestamp', 'N/A')}{skill_label}")
        print(f"    {e.get('action', 'N/A')}: {e.get('detail', '')}")
    print(f"\n{'═' * 55}")


def cmd_scan_all(args):
    """Scan all skills for security issues."""
    security_script = Path(__file__).parent / "security_check.py"
    if not security_script.exists():
        print(f"  ❌ security_check.py不存在")
        sys.exit(1)

    cmd = [sys.executable, str(security_script), "--all", "--skills-dir", str(SKILLS_DIR)]
    if args.json:
        cmd.append("--json")

    result = subprocess.run(cmd, capture_output=False, text=True)
    sys.exit(result.returncode)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _rescan_skill(skill_path: Path):
    """Run security scan on a skill."""
    security_script = Path(__file__).parent / "security_check.py"
    if security_script.exists():
        print(f"  🔒 安全扫描中...")
        result = subprocess.run(
            [sys.executable, str(security_script), "--path", str(skill_path)],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            print(f"  ✅ 安全扫描通过")
        else:
            print(f"  ⚠️  安全扫描发现问题:")
            print(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)


def _log_changelog(skill_name: str, action: str, detail: str):
    """Log a changelog entry."""
    changelog = {}
    if CHANGELOG_FILE.exists():
        try:
            changelog = json.loads(CHANGELOG_FILE.read_text())
        except json.JSONDecodeError:
            pass

    if skill_name not in changelog:
        changelog[skill_name] = []

    changelog[skill_name].append({
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "detail": detail[:500],
    })

    # Keep last 100 entries per skill
    for key in changelog:
        changelog[key] = changelog[key][-100:]

    CHANGELOG_FILE.write_text(json.dumps(changelog, ensure_ascii=False, indent=2))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Skill管理器")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    # list
    p_list = subparsers.add_parser("list", help="列出所有skill")
    p_list.add_argument("--json", action="store_true")

    # info
    p_info = subparsers.add_parser("info", help="查看skill详情")
    p_info.add_argument("--skill", required=True, help="Skill名称")
    p_info.add_argument("--json", action="store_true")

    # update
    p_update = subparsers.add_parser("update", help="更新skill")
    p_update.add_argument("--skill", help="Skill名称")
    p_update.add_argument("--all", action="store_true", help="更新所有skill")

    # self-update
    p_self = subparsers.add_parser("self-update", help="自迭代更新skill-manager")

    # remove
    p_remove = subparsers.add_parser("remove", help="删除skill")
    p_remove.add_argument("--skill", required=True, help="Skill名称")

    # changelog
    p_changelog = subparsers.add_parser("changelog", help="查看变更记录")
    p_changelog.add_argument("--skill", help="Skill名称（不填显示全部）")
    p_changelog.add_argument("--json", action="store_true")

    # scan-all
    p_scan = subparsers.add_parser("scan-all", help="扫描所有skill安全性")
    p_scan.add_argument("--json", action="store_true")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "list": cmd_list,
        "info": cmd_info,
        "update": cmd_update,
        "self-update": cmd_self_update,
        "remove": cmd_remove,
        "changelog": cmd_changelog,
        "scan-all": cmd_scan_all,
    }

    cmd_func = commands.get(args.command)
    if cmd_func:
        cmd_func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
