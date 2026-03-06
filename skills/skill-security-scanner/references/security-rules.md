# Security Rules Reference

## Rule Definitions

### Critical Rules

#### `dangerous-exec`

- **Severity**: Critical
- **Pattern**: `exec|execSync|spawn|spawnSync|execFile|execFileSync` with `child_process` context
- **Risk**: Arbitrary command execution, remote code injection
- **Rewrite**: Replace with allowlisted `execFile` wrapper

#### `dynamic-code-execution`

- **Severity**: Critical
- **Pattern**: `eval()`, `new Function()`
- **Risk**: Arbitrary JavaScript execution, prototype pollution
- **Rewrite**: Replace with static lookup tables or switch statements

#### `crypto-mining`

- **Severity**: Critical
- **Pattern**: `stratum+tcp`, `stratum+ssl`, `coinhive`, `cryptonight`, `xmrig`
- **Risk**: Unauthorized resource consumption
- **Rewrite**: Remove entirely, report to administrator

#### `env-harvesting`

- **Severity**: Critical
- **Pattern**: `process.env` combined with `fetch|post|http.request`
- **Risk**: Credential theft, secret exfiltration
- **Rewrite**: Restrict to named env vars, remove network transmission

### Warning Rules

#### `suspicious-network`

- **Severity**: Warning
- **Pattern**: WebSocket to non-standard ports (not 80/443/8080/8443/3000)
- **Risk**: Covert C2 channels, data tunneling

#### `potential-exfiltration`

- **Severity**: Warning
- **Pattern**: `readFileSync|readFile` combined with `fetch|post|http.request`
- **Risk**: Local file exfiltration

#### `obfuscated-code`

- **Severity**: Warning
- **Pattern**: Long hex-encoded strings `(\x##){6+}` or base64 payloads with `atob|Buffer.from`
- **Risk**: Hidden malicious payloads

### Additional Rules (Skill-specific)

#### `prompt-injection`

- **Severity**: Critical
- **Pattern**: "ignore previous instructions", "you are now", "system prompt override"
- **Risk**: Agent behavior manipulation
- **Rewrite**: Remove injection attempts, sanitize instructions

#### `path-traversal`

- **Severity**: Warning
- **Pattern**: `../` sequences, unvalidated path concatenation
- **Risk**: Filesystem escape, unauthorized file access

#### `hardcoded-secrets`

- **Severity**: Warning
- **Pattern**: API key patterns (`sk-*`, `ghp_*`, `AKIA*`), password assignments
- **Risk**: Credential leakage

## Scan Exemptions

Skills can declare safe patterns via frontmatter:

```yaml
metadata:
  openclaw:
    security:
      allow:
        - dangerous-exec # This skill legitimately needs exec
      reason: "Requires shell access for system monitoring"
```

Exemptions are logged and require explicit human approval.
