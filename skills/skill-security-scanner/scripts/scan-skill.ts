#!/usr/bin/env node
/**
 * skill-security-scanner/scripts/scan-skill.ts
 *
 * Standalone skill security scanner script.
 * Scans a skill directory for security vulnerabilities and outputs a report.
 *
 * Usage:
 *   bun scripts/scan-skill.ts <skill-directory>
 *   bun scripts/scan-skill.ts --all <skills-root>
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = "critical" | "warn" | "info";

type Finding = {
  ruleId: string;
  severity: Severity;
  file: string;
  line: number;
  message: string;
  evidence: string;
  rewritable: boolean;
};

type ScanReport = {
  skillName: string;
  scannedFiles: number;
  critical: number;
  warn: number;
  info: number;
  findings: Finding[];
  result: "CLEAN" | "PASSED_AFTER_REWRITE" | "BLOCKED" | "FLAGGED";
};

// ---------------------------------------------------------------------------
// Scannable extensions
// ---------------------------------------------------------------------------

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".jsx",
  ".tsx",
]);

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);

// ---------------------------------------------------------------------------
// Security Rules
// ---------------------------------------------------------------------------

type LineRule = {
  ruleId: string;
  severity: Severity;
  message: string;
  pattern: RegExp;
  requiresContext?: RegExp;
  rewritable: boolean;
};

type SourceRule = {
  ruleId: string;
  severity: Severity;
  message: string;
  pattern: RegExp;
  requiresContext?: RegExp;
  rewritable: boolean;
};

type MarkdownRule = {
  ruleId: string;
  severity: Severity;
  message: string;
  pattern: RegExp;
  rewritable: boolean;
};

const LINE_RULES: LineRule[] = [
  {
    ruleId: "dangerous-exec",
    severity: "critical",
    message: "Shell command execution detected (child_process)",
    pattern: /\b(exec|execSync|spawn|spawnSync|execFile|execFileSync)\s*\(/,
    requiresContext: /child_process/,
    rewritable: true,
  },
  {
    ruleId: "dynamic-code-execution",
    severity: "critical",
    message: "Dynamic code execution detected (eval/new Function)",
    pattern: /\beval\s*\(|new\s+Function\s*\(/,
    rewritable: true,
  },
  {
    ruleId: "crypto-mining",
    severity: "critical",
    message: "Possible crypto-mining reference detected",
    pattern: /stratum\+tcp|stratum\+ssl|coinhive|cryptonight|xmrig/i,
    rewritable: true,
  },
  {
    ruleId: "suspicious-network",
    severity: "warn",
    message: "WebSocket connection to non-standard port",
    pattern: /new\s+WebSocket\s*\(\s*["']wss?:\/\/[^"']*:(\d+)/,
    rewritable: false,
  },
  {
    ruleId: "hardcoded-secret",
    severity: "warn",
    message: "Possible hardcoded secret/API key detected",
    pattern:
      /(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36,}|AKIA[A-Z0-9]{16}|(?:password|secret|token|apikey)\s*[:=]\s*["'][^"']{8,}["'])/i,
    rewritable: true,
  },
  {
    ruleId: "path-traversal",
    severity: "warn",
    message: "Potential path traversal pattern detected",
    pattern: /(?:\.\.\/){2,}|path\.join\s*\([^)]*(?:req\.|user|input|param)/i,
    rewritable: true,
  },
];

const SOURCE_RULES: SourceRule[] = [
  {
    ruleId: "potential-exfiltration",
    severity: "warn",
    message: "File read combined with network send — possible data exfiltration",
    pattern: /readFileSync|readFile/,
    requiresContext: /\bfetch\b|\bpost\b|http\.request/i,
    rewritable: false,
  },
  {
    ruleId: "obfuscated-code",
    severity: "warn",
    message: "Hex-encoded string sequence detected (possible obfuscation)",
    pattern: /(\\x[0-9a-fA-F]{2}){6,}/,
    rewritable: false,
  },
  {
    ruleId: "obfuscated-code",
    severity: "warn",
    message: "Large base64 payload with decode call (possible obfuscation)",
    pattern: /(?:atob|Buffer\.from)\s*\(\s*["'][A-Za-z0-9+/=]{200,}["']/,
    rewritable: false,
  },
  {
    ruleId: "env-harvesting",
    severity: "critical",
    message: "Environment variable access combined with network send — credential harvesting risk",
    pattern: /process\.env/,
    requiresContext: /\bfetch\b|\bpost\b|http\.request/i,
    rewritable: true,
  },
];

const MARKDOWN_RULES: MarkdownRule[] = [
  {
    ruleId: "prompt-injection",
    severity: "critical",
    message: "Prompt injection attempt detected",
    pattern:
      /ignore\s+(all\s+)?previous\s+instructions|you\s+are\s+now\s+a|system\s+prompt\s+override|disregard\s+(all\s+)?prior/i,
    rewritable: true,
  },
  {
    ruleId: "prompt-injection",
    severity: "critical",
    message: "Jailbreak pattern detected",
    pattern: /\bDAN\s+mode\b|do\s+anything\s+now|pretend\s+you\s+have\s+no\s+restrictions/i,
    rewritable: true,
  },
];

const STANDARD_PORTS = new Set([80, 443, 8080, 8443, 3000]);

// ---------------------------------------------------------------------------
// Scanner Implementation
// ---------------------------------------------------------------------------

function truncate(s: string, max = 120): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function scanCodeSource(source: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = source.split("\n");
  const matched = new Set<string>();

  // Line rules
  for (const rule of LINE_RULES) {
    if (matched.has(rule.ruleId)) continue;
    if (rule.requiresContext && !rule.requiresContext.test(source)) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = rule.pattern.exec(line);
      if (!m) continue;

      if (rule.ruleId === "suspicious-network") {
        const port = parseInt(m[1], 10);
        if (STANDARD_PORTS.has(port)) continue;
      }

      findings.push({
        ruleId: rule.ruleId,
        severity: rule.severity,
        file: filePath,
        line: i + 1,
        message: rule.message,
        evidence: truncate(line.trim()),
        rewritable: rule.rewritable,
      });
      matched.add(rule.ruleId);
      break;
    }
  }

  // Source rules
  const matchedSource = new Set<string>();
  for (const rule of SOURCE_RULES) {
    const key = `${rule.ruleId}::${rule.message}`;
    if (matchedSource.has(key)) continue;
    if (!rule.pattern.test(source)) continue;
    if (rule.requiresContext && !rule.requiresContext.test(source)) continue;

    let matchLine = 0;
    let matchEvidence = "";
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        matchLine = i + 1;
        matchEvidence = lines[i].trim();
        break;
      }
    }
    if (matchLine === 0) {
      matchLine = 1;
      matchEvidence = source.slice(0, 120);
    }

    findings.push({
      ruleId: rule.ruleId,
      severity: rule.severity,
      file: filePath,
      line: matchLine,
      message: rule.message,
      evidence: truncate(matchEvidence),
      rewritable: rule.rewritable,
    });
    matchedSource.add(key);
  }

  return findings;
}

function scanMarkdown(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (const rule of MARKDOWN_RULES) {
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        findings.push({
          ruleId: rule.ruleId,
          severity: rule.severity,
          file: filePath,
          line: i + 1,
          message: rule.message,
          evidence: truncate(lines[i].trim()),
          rewritable: rule.rewritable,
        });
        break; // One finding per rule per file
      }
    }
  }

  return findings;
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SCANNABLE_EXTENSIONS.has(ext) || MARKDOWN_EXTENSIONS.has(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

function scanSkill(skillDir: string): ScanReport {
  const skillName = path.basename(skillDir);
  const files = collectFiles(skillDir);
  const allFindings: Finding[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const ext = path.extname(file).toLowerCase();
    const relPath = path.relative(skillDir, file);

    if (MARKDOWN_EXTENSIONS.has(ext)) {
      allFindings.push(...scanMarkdown(content, relPath));
    }
    if (SCANNABLE_EXTENSIONS.has(ext)) {
      allFindings.push(...scanCodeSource(content, relPath));
    }
  }

  const critical = allFindings.filter((f) => f.severity === "critical").length;
  const warn = allFindings.filter((f) => f.severity === "warn").length;
  const info = allFindings.filter((f) => f.severity === "info").length;

  let result: ScanReport["result"];
  if (critical === 0 && warn === 0) {
    result = "CLEAN";
  } else if (critical > 0 && allFindings.every((f) => f.severity !== "critical" || f.rewritable)) {
    result = "PASSED_AFTER_REWRITE";
  } else if (critical > 0) {
    result = "BLOCKED";
  } else {
    result = "FLAGGED";
  }

  return {
    skillName,
    scannedFiles: files.length,
    critical,
    warn,
    info,
    findings: allFindings,
    result,
  };
}

// ---------------------------------------------------------------------------
// Report Formatting
// ---------------------------------------------------------------------------

function formatReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════════════");
  lines.push("  Skill Security Scan Report");
  lines.push("═══════════════════════════════════════════════");
  lines.push(`  Skill: ${report.skillName}`);
  lines.push(`  Files scanned: ${report.scannedFiles}`);
  lines.push("");
  lines.push(`  Critical: ${report.critical}  ⛔`);
  lines.push(`  Warning:  ${report.warn}  ⚠️`);
  lines.push(`  Info:     ${report.info}  ℹ️`);

  if (report.findings.length > 0) {
    lines.push("");
    lines.push("  Findings:");
    lines.push("  ─────────────────────────────────────────────");
    for (const f of report.findings) {
      const tag =
        f.severity === "critical" ? "CRITICAL" : f.severity === "warn" ? "WARNING" : "INFO";
      lines.push(`  [${tag}] ${f.ruleId}`);
      lines.push(`    File: ${f.file}:${f.line}`);
      lines.push(`    Evidence: ${f.evidence}`);
      lines.push(`    Rewritable: ${f.rewritable ? "Yes ✅" : "No — manual review needed"}`);
      lines.push("");
    }
  }

  lines.push("  ─────────────────────────────────────────────");
  const resultEmoji = {
    CLEAN: "✅ CLEAN",
    PASSED_AFTER_REWRITE: "🔧 PASSED (after rewrites)",
    BLOCKED: "⛔ BLOCKED",
    FLAGGED: "⚠️ FLAGGED for review",
  };
  lines.push(`  Result: ${resultEmoji[report.result]}`);
  lines.push("═══════════════════════════════════════════════");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  bun scan-skill.ts <skill-directory>");
    console.log("  bun scan-skill.ts --all <skills-root>");
    process.exit(1);
  }

  if (args[0] === "--all") {
    const skillsRoot = args[1] || path.resolve(process.cwd(), "../../");
    if (!fs.existsSync(skillsRoot)) {
      console.error(`Skills root not found: ${skillsRoot}`);
      process.exit(1);
    }

    const entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
    let totalCritical = 0;
    let totalWarn = 0;
    let totalClean = 0;

    console.log(`\nScanning all skills in: ${skillsRoot}\n`);

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const skillPath = path.join(skillsRoot, entry.name);
      const skillMd = path.join(skillPath, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;

      const report = scanSkill(skillPath);
      console.log(formatReport(report));
      console.log("");

      totalCritical += report.critical;
      totalWarn += report.warn;
      if (report.result === "CLEAN") totalClean++;
    }

    console.log("═══════════════════════════════════════════════");
    console.log("  SUMMARY");
    console.log(`  Total Critical: ${totalCritical}`);
    console.log(`  Total Warnings: ${totalWarn}`);
    console.log(`  Clean Skills: ${totalClean}`);
    console.log("═══════════════════════════════════════════════");
  } else {
    const skillDir = path.resolve(args[0]);
    if (!fs.existsSync(skillDir)) {
      console.error(`Skill directory not found: ${skillDir}`);
      process.exit(1);
    }
    const report = scanSkill(skillDir);
    console.log(formatReport(report));
  }
}

main();
