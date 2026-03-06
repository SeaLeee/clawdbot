#!/usr/bin/env python3
"""
Skill Search & Download Engine

Search for skills from multiple sources:
- ClawHub (clawhub.com)
- GitHub trending repositories
- GitHub specific repositories

Usage:
    python3 search_skills.py --source clawhub --query "pdf processing"
    python3 search_skills.py --source github --query "agent skill"
    python3 search_skills.py --source github --repo "owner/repo" --path "skills/"
    python3 search_skills.py --source all --query "image generation"
    python3 search_skills.py --install <skill-name> --source clawhub
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SKILLS_DIR = Path(__file__).resolve().parent.parent.parent  # skills/ root
TEMP_DIR = Path(tempfile.gettempdir()) / "skill-manager-downloads"
CLAWHUB_REGISTRY = os.environ.get("CLAWHUB_REGISTRY", "https://clawhub.com")

# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def run_cmd(cmd: list[str], capture: bool = True, check: bool = True) -> subprocess.CompletedProcess:
    """Run a command and return result."""
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
        timeout=60,
    )


def ensure_temp_dir():
    """Ensure temp download directory exists."""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)


def print_results(results: list[dict], source: str):
    """Pretty-print search results."""
    if not results:
        print(f"\n  ⚠️  没有找到匹配的skill（来源: {source}）")
        return

    print(f"\n{'═' * 60}")
    print(f"  🔍 搜索结果 — 来源: {source}")
    print(f"{'═' * 60}")
    for i, r in enumerate(results, 1):
        stars = f"  ⭐ {r.get('stars', 'N/A')}" if r.get("stars") else ""
        print(f"\n  [{i}] {r['name']}{stars}")
        print(f"      {r.get('description', '无描述')}")
        if r.get("url"):
            print(f"      🔗 {r['url']}")
        if r.get("version"):
            print(f"      📦 v{r['version']}")
    print(f"\n{'═' * 60}")


# ---------------------------------------------------------------------------
# ClawHub Search
# ---------------------------------------------------------------------------

def search_clawhub(query: str) -> list[dict]:
    """Search ClawHub for skills using the clawhub CLI."""
    results = []

    # Check if clawhub CLI is available
    if not shutil.which("clawhub"):
        print("  ℹ️  clawhub CLI未安装，尝试使用 npm i -g clawhub 安装...")
        try:
            run_cmd(["npm", "i", "-g", "clawhub"])
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("  ⚠️  无法安装clawhub CLI，跳过ClawHub搜索")
            return results

    try:
        result = run_cmd(["clawhub", "search", query], check=False)
        if result.returncode == 0 and result.stdout.strip():
            # Parse clawhub search output
            for line in result.stdout.strip().split("\n"):
                line = line.strip()
                if not line or line.startswith("─") or line.startswith("═"):
                    continue
                # Attempt to parse structured output
                parts = line.split(None, 2)
                if len(parts) >= 2:
                    results.append({
                        "name": parts[0],
                        "description": parts[1] if len(parts) > 1 else "",
                        "source": "clawhub",
                        "url": f"{CLAWHUB_REGISTRY}/skills/{parts[0]}",
                    })
        else:
            # Fallback: try API directly
            results = _search_clawhub_api(query)
    except (subprocess.CalledProcessError, FileNotFoundError):
        results = _search_clawhub_api(query)

    return results


def _search_clawhub_api(query: str) -> list[dict]:
    """Fallback: search ClawHub via curl API."""
    results = []
    try:
        result = run_cmd(
            ["curl", "-s", f"{CLAWHUB_REGISTRY}/api/skills/search?q={query}"],
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout)
            skills = data if isinstance(data, list) else data.get("skills", [])
            for s in skills:
                results.append({
                    "name": s.get("name", s.get("slug", "unknown")),
                    "description": s.get("description", ""),
                    "version": s.get("version", ""),
                    "source": "clawhub",
                    "url": f"{CLAWHUB_REGISTRY}/skills/{s.get('slug', s.get('name', ''))}",
                })
    except (json.JSONDecodeError, Exception) as e:
        print(f"  ⚠️  ClawHub API搜索失败: {e}")
    return results


def install_from_clawhub(skill_name: str, target_dir: Path) -> Optional[Path]:
    """Install a skill from ClawHub."""
    if not shutil.which("clawhub"):
        print("  ❌ clawhub CLI未安装")
        return None

    try:
        result = run_cmd(
            ["clawhub", "install", skill_name, "--dir", str(target_dir)],
            check=False,
        )
        if result.returncode == 0:
            skill_path = target_dir / skill_name
            if skill_path.exists():
                print(f"  ✅ 已从ClawHub下载: {skill_name}")
                return skill_path
        print(f"  ❌ ClawHub安装失败: {result.stderr}")
    except Exception as e:
        print(f"  ❌ ClawHub安装异常: {e}")
    return None


# ---------------------------------------------------------------------------
# GitHub Search
# ---------------------------------------------------------------------------

def search_github(query: str, repo: str = None, path: str = None) -> list[dict]:
    """Search GitHub for skill repositories."""
    results = []

    if not shutil.which("gh"):
        print("  ⚠️  gh CLI未安装，请运行 brew install gh")
        return _search_github_api(query)

    if repo:
        # Search within a specific repo
        results = _search_github_repo(repo, path or "skills/")
    else:
        # Search across GitHub
        search_terms = f"{query} skill agent"
        try:
            result = run_cmd(
                ["gh", "search", "repos", search_terms,
                 "--sort", "stars", "--limit", "15",
                 "--json", "name,owner,description,stargazersCount,url"],
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                repos = json.loads(result.stdout)
                for r in repos:
                    results.append({
                        "name": r.get("name", ""),
                        "description": r.get("description", ""),
                        "stars": r.get("stargazersCount", 0),
                        "source": "github",
                        "url": r.get("url", ""),
                        "owner": r.get("owner", {}).get("login", ""),
                    })
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            print(f"  ⚠️  GitHub搜索失败: {e}")
            results = _search_github_api(query)

    return results


def _search_github_api(query: str) -> list[dict]:
    """Fallback: search GitHub via REST API with curl."""
    results = []
    try:
        encoded_query = query.replace(" ", "+") + "+skill+agent"
        result = run_cmd(
            ["curl", "-s",
             f"https://api.github.com/search/repositories?q={encoded_query}&sort=stars&per_page=15"],
            check=False,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            for item in data.get("items", []):
                results.append({
                    "name": item.get("name", ""),
                    "description": item.get("description", ""),
                    "stars": item.get("stargazers_count", 0),
                    "source": "github",
                    "url": item.get("html_url", ""),
                    "owner": item.get("owner", {}).get("login", ""),
                })
    except (json.JSONDecodeError, Exception) as e:
        print(f"  ⚠️  GitHub API搜索失败: {e}")
    return results


def _search_github_repo(repo: str, path: str) -> list[dict]:
    """Search for skills within a specific GitHub repo."""
    results = []
    try:
        result = run_cmd(
            ["gh", "api", f"/repos/{repo}/contents/{path}",
             "--jq", ".[].name"],
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            for name in result.stdout.strip().split("\n"):
                name = name.strip()
                if name and not name.startswith("."):
                    results.append({
                        "name": name,
                        "description": f"Skill from {repo}/{path}{name}",
                        "source": "github",
                        "url": f"https://github.com/{repo}/tree/main/{path}{name}",
                        "owner": repo.split("/")[0],
                    })
    except Exception as e:
        print(f"  ⚠️  GitHub仓库搜索失败: {e}")
    return results


def download_from_github(repo: str, skill_path: str, target_dir: Path) -> Optional[Path]:
    """Download a skill directory from a GitHub repo."""
    ensure_temp_dir()
    clone_dir = TEMP_DIR / f"gh-{repo.replace('/', '-')}"

    try:
        # Sparse checkout for efficiency
        if clone_dir.exists():
            shutil.rmtree(clone_dir)

        run_cmd(["git", "clone", "--depth", "1", "--filter=blob:none",
                 "--sparse", f"https://github.com/{repo}.git", str(clone_dir)],
                check=False)

        if clone_dir.exists():
            subprocess.run(
                ["git", "sparse-checkout", "set", skill_path],
                cwd=str(clone_dir), capture_output=True, text=True, check=False,
            )

            source = clone_dir / skill_path
            if source.exists():
                skill_name = Path(skill_path).name
                dest = target_dir / skill_name
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.copytree(source, dest)
                print(f"  ✅ 已从GitHub下载: {repo}/{skill_path}")
                return dest
            else:
                print(f"  ❌ 路径不存在: {skill_path}")
    except Exception as e:
        print(f"  ❌ GitHub下载失败: {e}")
    finally:
        if clone_dir.exists():
            shutil.rmtree(clone_dir, ignore_errors=True)

    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Skill搜索与下载引擎")
    parser.add_argument("--source", choices=["clawhub", "github", "all"], default="all",
                        help="搜索来源")
    parser.add_argument("--query", "-q", type=str, help="搜索关键词")
    parser.add_argument("--repo", type=str, help="GitHub仓库（owner/repo格式）")
    parser.add_argument("--path", type=str, default="skills/", help="仓库内skill路径")
    parser.add_argument("--install", type=str, help="安装指定skill名称")
    parser.add_argument("--target", type=str, default=str(SKILLS_DIR),
                        help="安装目标目录")
    parser.add_argument("--json", action="store_true", help="JSON格式输出")

    args = parser.parse_args()

    if args.install:
        # Installation mode
        target = Path(args.target)
        ensure_temp_dir()
        temp_target = TEMP_DIR / "install-staging"
        temp_target.mkdir(parents=True, exist_ok=True)

        installed = None
        if args.source in ("clawhub", "all"):
            installed = install_from_clawhub(args.install, temp_target)
        if not installed and args.source in ("github", "all") and args.repo:
            installed = download_from_github(args.repo, f"{args.path}{args.install}", temp_target)

        if installed:
            # Trigger security scan before final install
            print(f"\n  🔒 正在进行安全扫描...")
            security_script = Path(__file__).parent / "security_check.py"
            if security_script.exists():
                scan_result = subprocess.run(
                    [sys.executable, str(security_script), "--path", str(installed), "--auto-rewrite"],
                    capture_output=True, text=True,
                )
                print(scan_result.stdout)
                if scan_result.returncode != 0:
                    print(f"  ⚠️  安全扫描发现问题，请检查报告")
                    print(scan_result.stderr)

            # Move to final location
            final_path = target / installed.name
            if final_path.exists():
                shutil.rmtree(final_path)
            shutil.copytree(installed, final_path)
            print(f"\n  ✅ Skill已安装到: {final_path}")
        else:
            print(f"\n  ❌ 未能安装skill: {args.install}")
            sys.exit(1)
        return

    if not args.query and not args.repo:
        parser.error("需要 --query 或 --repo 参数")

    all_results = []

    if args.source in ("clawhub", "all") and args.query:
        results = search_clawhub(args.query)
        all_results.extend(results)
        if not args.json:
            print_results(results, "ClawHub")

    if args.source in ("github", "all"):
        results = search_github(args.query or "", args.repo, args.path)
        all_results.extend(results)
        if not args.json:
            print_results(results, "GitHub")

    if args.json:
        print(json.dumps(all_results, ensure_ascii=False, indent=2))
    elif all_results:
        print(f"\n  共找到 {len(all_results)} 个候选skill")
        print(f"  使用 --install <name> --source <source> 安装skill")
    else:
        print(f"\n  ❌ 未找到匹配的skill")


if __name__ == "__main__":
    main()
