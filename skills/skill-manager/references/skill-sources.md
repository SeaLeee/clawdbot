# Skill来源与搜索策略

## 来源概览

### 1. ClawHub (clawhub.com)

ClawHub是clawbot官方的skill注册中心，优先从这里搜索和安装skill。

**搜索方式：**
```bash
clawhub search "关键词"
clawhub list
```

**安装方式：**
```bash
clawhub install <skill-name>
clawhub install <skill-name> --version 1.2.3
```

**优势：**
- 官方审核过的skill
- 版本管理和更新机制
- 标准化的skill格式

### 2. GitHub

GitHub上有大量开源的agent skill仓库，可以从中搜索和下载。

**搜索策略：**
- 关键词：`agent skill`, `codex skill`, `clawbot skill`, `openclaw skill`
- 按星标数排序找热门仓库
- 搜索特定功能领域：`pdf skill`, `email skill`, `weather skill`

**搜索方式：**
```bash
# 全局搜索
gh search repos "agent skill" --sort stars --limit 15

# 搜索特定仓库内的skill
gh api /repos/owner/repo/contents/skills/
```

**安装方式：**
- 使用 sparse checkout 仅下载skill目录
- 自动检测SKILL.md验证格式

**注意事项：**
- GitHub上的skill未经官方审核，必须通过安全扫描
- 检查仓库的星标数、更新频率、issue数量评估质量
- 优先选择有LICENSE文件的仓库

### 3. 本地创建

当没有现成skill满足需求时，可以自动创建：

```bash
python3 scripts/create_skill.py --name "my-skill" --description "描述" --resources scripts
```

## 搜索策略

### 关键词生成

根据用户需求自动生成搜索关键词：

1. 提取核心功能词（如"PDF处理" → "pdf"）
2. 扩展同义词（如"邮件" → "email", "mail", "himalaya"）
3. 添加skill相关后缀（"pdf skill", "pdf agent"）

### 结果排序

搜索结果按以下优先级排序：

1. **来源优先级**: ClawHub > GitHub (starred > unstarred)
2. **相关性**: 名称匹配 > 描述匹配
3. **质量指标**: 星标数、更新频率、文件完整度

### 去重

当多个来源返回相同skill时：
- 以ClawHub版本为准
- 保留星标数最高的GitHub版本
- 合并描述信息

## 安装前检查

所有外部skill安装前必须：

1. ✅ 存在有效的 SKILL.md
2. ✅ YAML frontmatter包含 name 和 description
3. ✅ 通过安全扫描（security_check.py）
4. ✅ 隐私评分 ≥ 60/100
5. ✅ 不与已安装skill冲突（同名）

检查失败的处理：
- 缺少SKILL.md → 拒绝安装
- 安全扫描Critical → 自动改写后重新检查
- 安全扫描Warning → 标记并提示用户审核
- 隐私评分低 → 警告并建议不安装
