---
name: skill-manager
description: "Skills管家 — 全生命周期管理clawbot的skill。用于：(1) 搜索互联网/GitHub热门仓库/ClawHub下载skill，(2) 对所有下载的skill进行安全和隐私扫描，不安全的自动改写，(3) 根据需求自动创建新skill，(4) 自迭代更新已有skill，(5) 可视化面板管理所有skill。此skill优先级高于其他skill，是skill的元管理器。Use when: managing skills, searching for new skills, creating skills from requirements, auditing skill security, viewing skill dashboard, or self-iterating the skill system."
---

# Skill Manager — Skills管家

全生命周期管理clawbot的skill生态系统。具备搜索、下载、安全扫描、自动创建、自迭代、可视化管理能力。

## 优先级

此skill是**元管理器**，优先级高于其他skill。当涉及skill的创建、更新、搜索、安全审计时，优先使用此skill。

## 核心能力

### 1. 搜索与下载 Skill

从多个来源发现和获取skill：

```bash
# 从ClawHub搜索和安装
python3 scripts/search_skills.py --source clawhub --query "pdf processing"

# 从GitHub热门仓库搜索
python3 scripts/search_skills.py --source github --query "agent skill"

# 从GitHub特定仓库下载
python3 scripts/search_skills.py --source github --repo "owner/repo" --path "skills/"

# 搜索所有来源
python3 scripts/search_skills.py --source all --query "image generation"
```

搜索流程：
1. 解析用户需求，生成搜索关键词
2. 并行搜索ClawHub和GitHub
3. 按相关性排序结果
4. 展示候选skill列表（名称、描述、星标数、来源）
5. 用户选择后下载到临时目录
6. **自动触发安全扫描**（见下文）
7. 安全通过后安装到skills/目录

### 2. 安全与隐私扫描

所有下载的skill必须通过安全扫描才能安装：

```bash
# 扫描单个skill
python3 scripts/security_check.py --path /path/to/skill

# 扫描所有已安装skill
python3 scripts/security_check.py --all --skills-dir ./

# 扫描并自动改写不安全代码
python3 scripts/security_check.py --path /path/to/skill --auto-rewrite
```

安全扫描规则（集成 skill-security-scanner）：

**Critical（阻断并改写）：**
- `dangerous-exec` — shell命令执行（child_process）
- `dynamic-code-execution` — eval(), new Function()
- `crypto-mining` — 挖矿引用
- `env-harvesting` — 环境变量配合网络发送
- `prompt-injection` — 提示注入攻击

**Warning（标记待审核）：**
- `suspicious-network` — 非标准端口WebSocket
- `potential-exfiltration` — 文件读取配合网络发送
- `obfuscated-code` — 混淆代码
- `path-traversal` — 路径穿越
- `hardcoded-secrets` — 硬编码密钥

**隐私检查（额外）：**
- 检查是否收集用户数据
- 检查是否发送数据到未知域名
- 检查是否访问非必要的文件系统路径

安全处理策略：
- Critical发现 → 自动改写为安全版本
- Warning发现 → 标记供用户审核
- 改写后重新扫描确认安全
- 生成详细的扫描报告

### 3. 自动创建 Skill

根据需求描述自动生成新skill：

```bash
# 从需求描述创建skill
python3 scripts/create_skill.py --name "my-new-skill" \
  --description "处理PDF文件的合并与分割" \
  --resources scripts,references

# 交互式创建
python3 scripts/create_skill.py --interactive

# 基于模板创建
python3 scripts/create_skill.py --name "my-skill" --template workflow
```

创建流程：
1. 分析需求，确定skill名称和功能范围
2. 选择合适的skill结构模式（workflow/task/reference/capabilities）
3. 调用 skill-creator 的 `init_skill.py` 初始化骨架
4. 生成 SKILL.md（含frontmatter和指导内容）
5. 如需脚本，自动生成scripts/目录下的模板
6. 运行安全扫描验证
7. 可选：打包为 .skill 文件发布

### 4. 自迭代更新

skill-manager可以更新自身和其他skill：

```bash
# 更新skill-manager自身
python3 scripts/manage_skills.py self-update

# 更新指定skill
python3 scripts/manage_skills.py update --skill weather

# 更新所有skill
python3 scripts/manage_skills.py update --all

# 查看更新日志
python3 scripts/manage_skills.py changelog --skill weather
```

自迭代原则：
- 分析当前skill的使用效果和用户反馈
- 识别可改进的部分（描述、脚本、工作流）
- 生成改进差异并预览
- 确认后应用更新
- 更新后重新扫描安全性

### 5. 可视化管理面板

启动Web面板管理所有skill：

```bash
# 启动管理面板（默认端口 9527）
python3 scripts/skill_dashboard.py --port 9527

# 指定skills目录
python3 scripts/skill_dashboard.py --skills-dir ./ --port 9527
```

面板功能：
- 所有已安装skill的列表（名称、描述、状态）
- 每个skill的功能概要和安全评分
- 搜索与筛选
- 一键安全扫描
- 安装/卸载/更新操作
- skill依赖关系图

## 完整工作流

### 搜索并安装新skill

```
用户请求 → 搜索skill → 展示候选列表 → 用户选择 → 下载到临时目录 → 安全扫描
→ [安全] → 安装到skills/
→ [不安全-Critical] → 自动改写 → 重新扫描 → 安装
→ [不安全-Warning] → 标记并展示给用户审核
```

### 按需创建skill

```
用户需求 → 分析需求 → 确定结构 → 初始化 → 生成内容 → 安全扫描 → 安装
```

### 自迭代

```
使用反馈 → 分析改进点 → 生成差异 → 预览 → 应用更新 → 安全扫描
```

## 资源文件

- `scripts/search_skills.py` — 搜索与下载引擎
- `scripts/security_check.py` — 安全与隐私扫描器
- `scripts/create_skill.py` — Skill创建工具
- `scripts/manage_skills.py` — 核心管理操作（更新、列表、自迭代）
- `scripts/skill_dashboard.py` — 可视化管理面板服务器
- `references/self-iteration.md` — 自迭代策略指南
- `references/skill-sources.md` — Skill来源与搜索策略
- `assets/dashboard/index.html` — 面板前端页面
- `assets/dashboard/style.css` — 面板样式
- `assets/dashboard/app.js` — 面板交互逻辑
