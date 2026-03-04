# 快速开始指南

## 1. 环境准备

### 系统要求
- **操作系统**：macOS 10.13 或更高版本
- **Node.js**：v18.0.0 或更高版本
- **pnpm**：推荐使用 pnpm 作为包管理器

### 检查环境
```bash
# 检查 Node.js 版本
node --version

# 检查 pnpm 版本（如果未安装，执行下面的命令）
npm install -g pnpm
pnpm --version
```

## 2. 快速启动

### 方式 A：使用自动化脚本（推荐）
```bash
cd /path/to/clawdbot/plugin/Launcher

# 运行设置脚本
bash setup.sh

# 启动开发模式
pnpm run electron-dev
```

### 方式 B：手动启动
```bash
cd /path/to/clawdbot/plugin/Launcher

# 1. 安装依赖
pnpm install

# 2. 启动开发服务器和 Electron
pnpm run electron-dev
```

## 3. 项目介绍

### 主要目录结构
```
src/
├── main.ts                    # Electron 主进程入口
├── preload.ts                 # 预加载脚本（IPC 通道暴露）
├── types.ts                   # 类型定义
├── utils/
│   ├── launchAgent.ts         # macOS 前台启动配置
│   └── processManager.ts      # 进程启动和管理
└── renderer/
    ├── index.html             # 主窗口 HTML
    ├── main.tsx               # React 入口
    ├── App.tsx                # 主应用组件
    └── styles.css             # 全局样式
```

### 核心功能

#### 启动管理
- **OpenClaw**：启动 `/path/to/clawdbot/openclaw.mjs`
- **Crabwalk**：启动 `/path/to/crabwalk` 的开发服务器

#### LaunchAgent（macOS 开机启动）
- **自动配置**：应用自动管理 LaunchAgent plist 文件
- **路径**：`~/Library/LaunchAgents/com.clawdbot.launcher.plist`
- **功能**：系统启动时自动运行本应用

## 4. 开发工作流

### 修改代码后的操作

#### 修改 React 组件（src/renderer/）
- 自动热重载（HMR），无需重启

#### 修改 Electron 主进程（src/main.ts）
- 需要手动停止并重启开发服务器
- 使用快捷键 `Ctrl+C` 停止，然后重新执行 `pnpm run electron-dev`

#### 修改 IPC 接口（src/preload.ts）
- 需要重启 Electron

### 调试

#### Chrome DevTools
- 开发模式下自动打开 DevTools
- 在右侧面板调试渲染进程

#### 主进程调试
- 在 VS Code 中配置 Node.js 调试器
- 查看 `src/main.ts` 的 console.log() 输出

## 5. 常见命令

```bash
# 开发模式（推荐）
pnpm run electron-dev

# 仅启动 Vite 开发服务器
pnpm run dev

# 仅启动 Electron（需要先启动 dev 服务器）
pnpm run electron

# 类型检查
pnpm run type-check

# 构建生产版本
pnpm run build

# 预览生产构建
pnpm run preview
```

## 6. 打包和分发

### 构建 DMG 文件
```bash
pnpm run build
```

构建产物位置：`release/ClawBot Launcher-*.dmg`

### 手动安装
```bash
# 挂载 DMG
open release/ClawBot\ Launcher-*.dmg

# 将 app 拖到 /Applications
cp -r /Volumes/ClawBot\ Launcher/ClawBot\ Launcher.app /Applications/

# 卸载 DMG
hdiutil eject /Volumes/ClawBot\ Launcher
```

## 7. 故障排除

### 问题：pnpm: command not found
```bash
npm install -g pnpm
```

### 问题：无法启动 OpenClaw
1. 确认 `/path/to/clawdbot/`  目录存在
2. 确认 `openclaw.mjs` 文件存在
3. 查看应用内日志标签页的错误信息

### 问题：无法启动 Crabwalk
1. 确认 `/path/to/crabwalk/` 目录存在
2. 执行：`cd ~/Desktop/github/crabwalk && pnpm install`
3. 查看应用内日志标签页的错误信息

### 问题：开机启动不工作
1. 在设置中禁用后重新启用 LaunchAgent
2. 手动验证：`launchctl list | grep clawdbot`
3. 查看日志：`tail -f ~/.clawdbot-launcher-error.log`

### 问题：应用崩溃
1. 查看终端输出中的错误信息
2. 检查 `~/.clawdbot-launcher-error.log`
3. 清除依赖并重新安装：
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   pnpm run electron-dev
   ```

## 8. 进阶配置

### 修改启动路径
编辑 [src/utils/processManager.ts](src/utils/processManager.ts)，修改以下函数中的路径：
- `startOpenClaw()` - 修改 `openclawDir`
- `startCrabwalk()` - 修改 `crabwalkDir`

### 修改应用名称
编辑 [package.json](package.json)，修改 `build.productName`

### 修改应用图标
1. 替换 `assets/icon.png` 为你的图标
2. 构建时会自动转换为不同格式

## 9. 相关文档

- [README.md](README.md) - 完整项目说明
- [Electron 官方文档](https://www.electronjs.org/docs)
- [React 官方文档](https://react.dev)
- [TypeScript 官方文档](https://www.typescriptlang.org)

## 10. 获取帮助

如遇问题，请：
1. 查看应用内的日志标签页
2. 检查终端输出的错误信息
3. 查看系统日志文件
4. 参考本指南的故障排除部分
