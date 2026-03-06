#!/usr/bin/env python3
"""
Skill Creator — Generate new skills from requirements.

Creates complete skill packages with SKILL.md, scripts, references, and assets
based on user requirements. Integrates with skill-creator's init_skill.py for
skeleton generation.

Usage:
    python3 create_skill.py --name "my-skill" --description "What it does"
    python3 create_skill.py --name "my-skill" --description "desc" --resources scripts,references
    python3 create_skill.py --name "my-skill" --template workflow
    python3 create_skill.py --interactive
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SKILLS_DIR = Path(__file__).resolve().parent.parent.parent
SKILL_CREATOR_INIT = SKILLS_DIR / "skill-creator" / "scripts" / "init_skill.py"
MAX_NAME_LENGTH = 64

TEMPLATES = {
    "workflow": {
        "structure": "工作流导向 — 适合有明确步骤的顺序流程",
        "sections": ["## 工作流", "### 步骤 1", "### 步骤 2", "### 步骤 3"],
    },
    "task": {
        "structure": "任务导向 — 适合提供不同操作/功能的工具集",
        "sections": ["## 快速开始", "## 任务类别 1", "## 任务类别 2"],
    },
    "reference": {
        "structure": "参考导向 — 适合标准、规范、指南类内容",
        "sections": ["## 指南概览", "## 规范详情", "## 使用示例"],
    },
    "capabilities": {
        "structure": "能力导向 — 适合集成多种相关功能的系统",
        "sections": ["## 核心能力", "### 1. 功能A", "### 2. 功能B", "### 3. 功能C"],
    },
}

# ---------------------------------------------------------------------------
# Name Validation
# ---------------------------------------------------------------------------

def validate_name(name: str) -> str:
    """Validate and normalize skill name."""
    # Normalize to hyphen-case
    normalized = re.sub(r"[^a-z0-9-]", "-", name.lower().strip())
    normalized = re.sub(r"-+", "-", normalized).strip("-")

    if not normalized:
        raise ValueError(f"无效的skill名称: {name}")
    if len(normalized) > MAX_NAME_LENGTH:
        raise ValueError(f"Skill名称过长（最大{MAX_NAME_LENGTH}字符）: {normalized}")

    return normalized


# ---------------------------------------------------------------------------
# Skill Generation
# ---------------------------------------------------------------------------

def generate_skill_md(name: str, description: str, template: str = "task",
                      resources: list[str] = None) -> str:
    """Generate SKILL.md content."""
    tmpl = TEMPLATES.get(template, TEMPLATES["task"])

    sections_md = ""
    for section in tmpl["sections"]:
        sections_md += f"\n{section}\n\n[TODO: 添加内容]\n"

    resources_md = ""
    if resources:
        resources_md = "\n## 资源\n"
        if "scripts" in resources:
            resources_md += "\n### scripts/\n\n- [TODO: 添加执行脚本]\n"
        if "references" in resources:
            resources_md += "\n### references/\n\n- [TODO: 添加参考文档]\n"
        if "assets" in resources:
            resources_md += "\n### assets/\n\n- [TODO: 添加资源文件]\n"

    content = f"""---
name: {name}
description: "{description}"
---

# {name.replace('-', ' ').title()}

## 概览

{description}

## 结构模式

使用 {tmpl['structure']}
{sections_md}{resources_md}"""

    return content


def create_skill(name: str, description: str, template: str = "task",
                 resources: list[str] = None, target_dir: Path = None) -> Path:
    """Create a new skill directory with all necessary files."""
    name = validate_name(name)
    target = target_dir or SKILLS_DIR
    skill_path = target / name

    if skill_path.exists():
        print(f"  ⚠️  Skill已存在: {skill_path}")
        print(f"  使用 manage_skills.py update 来更新")
        return skill_path

    # Try using skill-creator's init_skill.py if available
    if SKILL_CREATOR_INIT.exists():
        print(f"  📦 使用 skill-creator 初始化...")
        cmd = [
            sys.executable, str(SKILL_CREATOR_INIT),
            name, "--path", str(target),
        ]
        if resources:
            cmd.extend(["--resources", ",".join(resources)])

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"  ✅ 骨架已生成")
            # Overwrite SKILL.md with our generated content
            skill_md_path = skill_path / "SKILL.md"
            if skill_md_path.exists():
                content = generate_skill_md(name, description, template, resources)
                skill_md_path.write_text(content, encoding="utf-8")
                print(f"  ✅ SKILL.md已更新")
        else:
            print(f"  ⚠️  init_skill.py失败，手动创建...")
            _manual_create(name, description, template, resources, skill_path)
    else:
        print(f"  ℹ️  skill-creator不可用，手动创建...")
        _manual_create(name, description, template, resources, skill_path)

    # Generate template scripts if requested
    if resources and "scripts" in resources:
        _generate_template_scripts(skill_path, name)

    print(f"\n  ✅ Skill已创建: {skill_path}")
    print(f"  📁 目录结构:")
    _print_tree(skill_path, prefix="     ")

    return skill_path


def _manual_create(name: str, description: str, template: str,
                   resources: list[str], skill_path: Path):
    """Manually create skill directory structure."""
    skill_path.mkdir(parents=True, exist_ok=True)

    # Create SKILL.md
    content = generate_skill_md(name, description, template, resources)
    (skill_path / "SKILL.md").write_text(content, encoding="utf-8")

    # Create resource directories
    if resources:
        for res in resources:
            (skill_path / res).mkdir(exist_ok=True)


def _generate_template_scripts(skill_path: Path, name: str):
    """Generate template script files."""
    scripts_dir = skill_path / "scripts"
    scripts_dir.mkdir(exist_ok=True)

    # Create a main.py template
    main_py = scripts_dir / "main.py"
    if not main_py.exists():
        main_py.write_text(dedent(f"""\
            #!/usr/bin/env python3
            \"\"\"
            {name} — 主脚本

            Usage:
                python3 main.py [options]
            \"\"\"

            import argparse
            import sys


            def main():
                parser = argparse.ArgumentParser(description="{name}")
                # [TODO: 添加参数]
                args = parser.parse_args()

                # [TODO: 实现主逻辑]
                print(f"  ✅ {name} 执行完成")


            if __name__ == "__main__":
                main()
        """), encoding="utf-8")
        os.chmod(main_py, 0o755)


def _print_tree(path: Path, prefix: str = ""):
    """Print directory tree."""
    entries = sorted(path.iterdir(), key=lambda p: (p.is_file(), p.name))
    for i, entry in enumerate(entries):
        is_last = i == len(entries) - 1
        connector = "└── " if is_last else "├── "
        print(f"{prefix}{connector}{entry.name}{'/' if entry.is_dir() else ''}")
        if entry.is_dir():
            extension = "    " if is_last else "│   "
            _print_tree(entry, prefix + extension)


# ---------------------------------------------------------------------------
# Interactive mode
# ---------------------------------------------------------------------------

def interactive_create():
    """Interactive skill creation mode."""
    print(f"\n{'═' * 55}")
    print(f"  🛠️  交互式Skill创建")
    print(f"{'═' * 55}")

    name = input("\n  Skill名称: ").strip()
    if not name:
        print("  ❌ 名称不能为空")
        sys.exit(1)

    name = validate_name(name)
    print(f"  → 标准化名称: {name}")

    description = input("  功能描述: ").strip()
    if not description:
        print("  ❌ 描述不能为空")
        sys.exit(1)

    print(f"\n  可用模板:")
    for key, val in TEMPLATES.items():
        print(f"    [{key}] {val['structure']}")

    template = input(f"\n  选择模板 [task]: ").strip() or "task"
    if template not in TEMPLATES:
        print(f"  ⚠️  未知模板，使用默认 task")
        template = "task"

    res_input = input("  需要的资源 (scripts,references,assets，回车跳过): ").strip()
    resources = [r.strip() for r in res_input.split(",") if r.strip()] if res_input else None

    print(f"\n  📋 确认:")
    print(f"     名称: {name}")
    print(f"     描述: {description}")
    print(f"     模板: {template}")
    print(f"     资源: {resources or '无'}")

    confirm = input("\n  确认创建? [Y/n]: ").strip().lower()
    if confirm and confirm != "y":
        print("  ❌ 已取消")
        sys.exit(0)

    return create_skill(name, description, template, resources)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Skill创建工具")
    parser.add_argument("--name", type=str, help="Skill名称")
    parser.add_argument("--description", "-d", type=str, help="Skill功能描述")
    parser.add_argument("--template", "-t", choices=list(TEMPLATES.keys()),
                        default="task", help="Skill模板类型")
    parser.add_argument("--resources", "-r", type=str,
                        help="需要的资源目录（逗号分隔: scripts,references,assets）")
    parser.add_argument("--target", type=str, default=str(SKILLS_DIR),
                        help="目标目录")
    parser.add_argument("--interactive", "-i", action="store_true",
                        help="交互式创建模式")
    parser.add_argument("--json", action="store_true", help="JSON格式输出")

    args = parser.parse_args()

    if args.interactive:
        skill_path = interactive_create()
    elif args.name and args.description:
        resources = [r.strip() for r in args.resources.split(",") if r.strip()] if args.resources else None
        skill_path = create_skill(
            args.name, args.description, args.template,
            resources, Path(args.target),
        )
    else:
        parser.error("需要 --name 和 --description 参数，或使用 --interactive 模式")
        return

    if args.json:
        print(json.dumps({
            "skill_path": str(skill_path),
            "name": skill_path.name,
            "created": skill_path.exists(),
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()
