# ClawBot Launcher

一个功能完整的 Electron 桌面应用启动器，用于管理 OpenClaw 和 Crabwalk 两个服务。

## 主要功能

### 🚀 启动管理
- **一键启动/停止** OpenClaw（AI Agent 框架）
- **一键启动/停止** Crabwalk（可视化监控面板）
- **实时状态监控**：显示各服务的运行状态

### ⚙️ 开机启动
- **macOS LaunchAgent 集成**：支持系统自动启动
- **简单的启用/禁用开关**：在设置面板中轻松配置

### 📊 监控和日志
- **实时日志记录**：查看应用的所有操作日志
- **进程实时监控**：定期检查服务进程状态

## 项目结构

```
Launcher/
├── src/
│   ├── main.ts                 # Electron 主进程
│   ├── preload.ts              # 预加载脚本（IPC 通道）
│   ├── utils/
│   │   ├── launchAgent.ts      # macOS LaunchAgent 管理
│   │   └── processManager.ts   # 进程启动/停止管理
│   └── renderer/
│       ├── index.html          # 主窗口 HTML
│       ├── main.tsx            # React 入口
│       ├── App.tsx             # 主应用组件
│       └── styles.css          # 样式文件
├── package.json                # 项目依赖配置
├── tsconfig.json               # TypeScript 配置
├── vite.config.ts              # Vite 构建配置
└── README.md                   # 本文件
```

## 安装和运行

### 前置条件
- Node.js 18+
- pnpm（用于项目管理）
- macOS 10.13 或更高版本

### 开发模式

```bash
# 进入项目目录
cd /path/to/clawdbot/plugin/Launcher

# 安装依赖
pnpm install

# 启动开发服务器和 Electron
pnpm run electron-dev
```

### 构建

```bash
# 构建并打包应用
pnpm run build

# 仅构建（不打包）
pnpm run preview
```

## 功能说明

### 启动器标签页
- **OpenClaw 卡片**：启动/停止 OpenClaw 服务
  - 自动启动父目录 `/path/to/clawdbot` 中的 `openclaw.mjs`
  
- **Crabwalk 卡片**：启动/停止 Crabwalk 服务
  - 自动启动 `/path/to/crabwalk` 中的开发服务器

### 设置标签页
- **开机启动开关**：启用/禁用 macOS LaunchAgent
  - 启用后，系统启动时将自动运行 Launcher
  - 配置文件位置：`~/Library/LaunchAgents/com.clawdbot.launcher.plist`

### 日志标签页
- 显示应用所有操作的日志记录
- 支持清空日志功能
- 最多保留 50 条日志

## 工作原理

### 进程管理
- OpenClaw：通过执行 `node openclaw.mjs` 启动
- Crabwalk：通过执行 `pnpm dev` 启动

### LaunchAgent（开机启动）
macOS 使用 LaunchAgent 实现开机启动。由于 Electron app 打包后的位置可能变化，建议：

1. **开发阶段**：手动测试启用/禁用功能
2. **生产阶段**：在 app 最终位置确定后执行一次启用

## 系统集成

### 日志位置
- 应用日志：本应用内的日志标签页
- 进程日志：
  - OpenClaw：stdout/stderr 在启动时显示
  - Crabwalk：stdout/stderr 在启动时显示

### LaunchAgent 配置
自动生成的 plist 文件包含：
- 启动路径：应用执行文件路径
- 日志输出：`~/.clawdbot-launcher.log` 和 `~/.clawdbot-launcher-error.log`

## 故障排除

### OpenClaw 无法启动
- 检查 `/path/to/clawdbot` 目录是否存在
- 检查 `openclaw.mjs` 文件是否存在且有执行权限
- 查看日志标签页的错误信息

### Crabwalk 无法启动
- 检查 `/path/to/crabwalk` 目录是否存在
- 确认已在 crabwalk 目录执行过 `pnpm install`
- 检查 pnpm 是否正确安装

### LaunchAgent 不工作
- 检查 `~/Library/LaunchAgents/com.clawdbot.launcher.plist` 是否存在
- 手动加载：`launchctl load ~/Library/LaunchAgents/com.clawdbot.launcher.plist`
- 查看加载状态：`launchctl list | grep clawdbot`

## 技术栈

- **Electron 27+**：跨平台桌面应用框架
- **React 18+**：UI 框架
- **TypeScript 5+**：类型安全
- **Vite 5+**：高速构建工具
- **Lucide React**：图标库

## License

MIT

## 作者

Created for ClawBot Project
