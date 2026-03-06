#!/usr/bin/env python3
"""
Skill Dashboard — Web-based visual management panel for clawbot skills.

Provides a clean web UI to browse, search, scan, and manage all installed skills.

Usage:
    python3 skill_dashboard.py --port 9527
    python3 skill_dashboard.py --skills-dir ./ --port 9527
"""

import argparse
import http.server
import json
import os
import re
import subprocess
import sys
import threading
from functools import partial
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SKILLS_DIR = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets" / "dashboard"
SELF_SCRIPTS = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# Skill Data
# ---------------------------------------------------------------------------

def parse_skill_md(skill_path: Path) -> dict:
    """Parse SKILL.md and extract metadata."""
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
        "lines": content.count("\n") + 1,
    }

    # Parse YAML frontmatter
    fm_match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if fm_match:
        fm_text = fm_match.group(1)
        name_match = re.search(r"^name:\s*(.+)$", fm_text, re.MULTILINE)
        if name_match:
            info["name"] = name_match.group(1).strip().strip("\"'")

        desc_match = re.search(r"^description:\s*[\"']?(.+?)(?:[\"']?\s*)$", fm_text, re.MULTILINE)
        if desc_match:
            info["description"] = desc_match.group(1).strip().strip("\"'")

        # Extract emoji from metadata
        emoji_match = re.search(r'"emoji"\s*:\s*"([^"]+)"', fm_text)
        if emoji_match:
            info["emoji"] = emoji_match.group(1)

    # Extract first heading as title
    heading_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    if heading_match:
        info["title"] = heading_match.group(1).strip()

    return info


def get_all_skills(skills_dir: Path) -> list[dict]:
    """Get all skills with metadata."""
    skills = []
    for entry in sorted(skills_dir.iterdir()):
        if entry.is_dir() and (entry / "SKILL.md").exists():
            info = parse_skill_md(entry)
            if info:
                skills.append(info)
    return skills


def scan_skill_security(skill_path: Path) -> dict:
    """Run security scan on a skill and return results."""
    security_script = SELF_SCRIPTS / "security_check.py"
    if not security_script.exists():
        return {"error": "security_check.py not found"}

    try:
        result = subprocess.run(
            [sys.executable, str(security_script), "--path", str(skill_path), "--json"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout)
            return data[0] if isinstance(data, list) and data else {"error": "empty result"}
        return {"error": result.stderr or "scan failed"}
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------------------------

class DashboardHandler(http.server.BaseHTTPRequestHandler):
    skills_dir: Path = SKILLS_DIR

    def log_message(self, format, *args):
        """Suppress default logging for cleaner output."""
        pass

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _send_file(self, fpath: Path, content_type: str):
        if not fpath.exists():
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.end_headers()
        self.wfile.write(fpath.read_bytes())

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        # API routes
        if path == "/api/skills":
            skills = get_all_skills(self.skills_dir)
            self._send_json(skills)

        elif path == "/api/skill" and "name" in params:
            name = params["name"][0]
            skill_path = self.skills_dir / name
            if skill_path.exists():
                info = parse_skill_md(skill_path)
                # Read SKILL.md content
                skill_md = skill_path / "SKILL.md"
                if skill_md.exists():
                    info["content"] = skill_md.read_text(encoding="utf-8", errors="replace")
                self._send_json(info)
            else:
                self._send_json({"error": "Skill not found"}, 404)

        elif path == "/api/scan" and "name" in params:
            name = params["name"][0]
            skill_path = self.skills_dir / name
            if skill_path.exists():
                result = scan_skill_security(skill_path)
                self._send_json(result)
            else:
                self._send_json({"error": "Skill not found"}, 404)

        elif path == "/api/stats":
            skills = get_all_skills(self.skills_dir)
            stats = {
                "total": len(skills),
                "with_scripts": sum(1 for s in skills if s.get("has_scripts")),
                "with_references": sum(1 for s in skills if s.get("has_references")),
                "with_assets": sum(1 for s in skills if s.get("has_assets")),
                "total_files": sum(s.get("file_count", 0) for s in skills),
                "total_lines": sum(s.get("lines", 0) for s in skills),
            }
            self._send_json(stats)

        # Static files
        elif path == "/" or path == "/index.html":
            self._send_file(ASSETS_DIR / "index.html", "text/html")
        elif path == "/style.css":
            self._send_file(ASSETS_DIR / "style.css", "text/css")
        elif path == "/app.js":
            self._send_file(ASSETS_DIR / "app.js", "application/javascript")
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Skill可视化管理面板")
    parser.add_argument("--port", type=int, default=9527, help="服务端口")
    parser.add_argument("--skills-dir", type=str, default=str(SKILLS_DIR), help="Skills根目录")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="绑定地址")

    args = parser.parse_args()

    DashboardHandler.skills_dir = Path(args.skills_dir)

    server = http.server.HTTPServer((args.host, args.port), DashboardHandler)

    print(f"\n{'═' * 55}")
    print(f"  🎛️  Skill Manager Dashboard")
    print(f"{'═' * 55}")
    print(f"  地址: http://{args.host}:{args.port}")
    print(f"  Skills目录: {args.skills_dir}")
    print(f"  按 Ctrl+C 停止服务")
    print(f"{'═' * 55}\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n  🛑 服务已停止")
        server.server_close()


if __name__ == "__main__":
    main()
