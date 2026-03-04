# 构建 macOS 应用程序

## 快速构建

### 1. 确保环境正确

```bash
# 使用 Node 22
export PATH="/opt/homebrew/Cellar/node@22/22.22.0/bin:$PATH"
node --version  # 应该显示 v22.x.x

# 安装依赖
cd /path/to/clawdbot/plugin/Launcher
pnpm install
```

### 2. 构建应用

```bash
# 构建生产版本
pnpm run build
```

构建完成后，会在 `release/` 目录生成：
- `ClawBot Launcher-1.0.0.dmg` - 安装包
- `ClawBot Launcher-1.0.0-mac.zip` - 便携版
- `mac/` 目录 - 未签名的应用包

### 3. 运行打包后的应用

**方式 A：直接运行（未签名）**
```bash
# 第一次运行需要右键打开（避免 Gatekeeper）
open release/mac/ClawBot\ Launcher.app
```

**方式 B：安装 DMG**
```bash
open "release/ClawBot Launcher-1.0.0.dmg"
# 将应用拖到 Applications 文件夹
```

---

## 配置开机自启动（打包后）

应用打包后，开机自启动功能需要在应用内部启用：

1. 打开 **ClawBot Launcher.app**
2. 进入「设置」或「自动启动」标签页
3. 点击「开机自动启动 Launcher」→ 启用

这会创建 `~/Library/LaunchAgents/com.clawdbot.launcher.plist`

---

## 完全自动化的工作流程

要实现「开机 → 自动启动 Launcher → 自动启动 OpenClaw + Crabwalk → 自动打开浏览器」：

### 步骤 1：打包并安装应用

```bash
# 构建
pnpm run build

# 安装到 Applications
open "release/ClawBot Launcher-1.0.0.dmg"
# 拖拽到 Applications 文件夹
```

### 步骤 2：在应用中配置自动启动

1. 从 Applications 打开 **ClawBot Launcher**
2. 进入「自动启动」标签页
3. 启用以下选项：
   - ✅ 开机自动启动 Launcher
   - ✅ 启动后自动启动 OpenClaw
   - ✅ 自动打开 OpenClaw WebUI
   - ✅ 启动后自动启动 Crabwalk
   - ✅ 自动打开 Crabwalk WebUI

### 步骤 3：测试

```bash
# 注销并重新登录，或重启电脑
# 验证 LaunchAgent 是否已加载
launchctl list | grep clawdbot

# 手动测试启动
launchctl start com.clawdbot.launcher
```

---

## 故障排除

### "应用已损坏，无法打开"

未签名的应用会被 Gatekeeper 阻止：

```bash
# 移除隔离属性
xattr -rd com.apple.quarantine "/Applications/ClawBot Launcher.app"
```

### LaunchAgent 不工作

```bash
# 检查 plist 文件是否存在
cat ~/Library/LaunchAgents/com.clawdbot.launcher.plist

# 手动加载
launchctl load ~/Library/LaunchAgents/com.clawdbot.launcher.plist

# 查看日志
tail -f ~/.clawdbot-launcher.log
```

### 应用路径变化

如果将应用移动到不同位置，需要重新启用开机启动：

1. 在应用中禁用「开机自动启动」
2. 再重新启用

这会重新生成 plist 文件中的正确路径。

---

## 开发模式 vs 生产模式

| 功能 | 开发模式 (`pnpm run electron-dev`) | 生产模式 (打包后) |
|-----|-----------------------------------|------------------|
| 配置存储 | localStorage + 文件 | 文件系统 |
| 开机自启动 | 需要手动配置 LaunchAgent | 应用内一键启用 |
| OpenClaw/Crabwalk 路径 | 硬编码开发路径 | 需要配置或自动检测 |
| 自动启动服务 | ✅ 支持 | ✅ 支持 |

---

## 自定义配置（可选）

修改 `package.json` 中的 `build` 字段来自定义应用信息：

```json
{
  "build": {
    "appId": "com.clawdbot.launcher",
    "productName": "ClawBot Launcher",
    "directories": {
      "output": "release"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.utilities"
    }
  }
}
```
