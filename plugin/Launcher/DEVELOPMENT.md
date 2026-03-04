# 开发与发布指南

## 项目架构

### 技术堆栈
- **Electron 27+** - 跨平台桌面应用框架
- **React 18+** - UI 框架
- **TypeScript 5+** - 类型安全的编程语言
- **Vite 5+** - 快速的构建工具
- **electron-builder** - Electron 应用打包工具

### 项目结构

```
Launcher/
├── src/
│   ├── main.ts                 # Electron 主进程入口
│   ├── preload.ts              # 预加载脚本（IPC 通道）
│   ├── types.ts                # TypeScript 类型定义
│   ├── utils/                  # 工具函数
│   │   ├── launchAgent.ts      # macOS LaunchAgent 管理
│   │   └── processManager.ts   # 进程启动/停止
│   └── renderer/               # React 渲染进程
│       ├── index.html          # HTML 入口
│       ├── main.tsx            # React 入口
│       ├── App.tsx             # 主应用组件
│       └── styles.css          # 样式
├── dist/                       # 构建输出目录
│   ├── main.js                 # 编译后的主进程
│   ├── preload.js              # 编译后的预加载脚本
│   └── renderer/               # 编译后的渲染进程
├── release/                    # 打包后的应用
├── package.json                # 项目配置
├── vite.config.ts              # Vite 构建配置
├── tsconfig.json               # TypeScript 配置
└── README.md                   # 项目说明
```

## 开发流程

### 1. 本地开发（开发模式）

```bash
# 进入项目目录
cd /path/to/clawdbot/plugin/Launcher

# 安装依赖（首次运行）
pnpm install

# 启动开发服务器
pnpm run electron-dev
```

此命令会：
1. 启动 Vite 开发服务器（端口 5173）
2. 启动 Electron 应用
3. 自动打开 DevTools 進行调试

### 2. 修改代码

#### 前端代码（React 组件）
- **文件位置**：`src/renderer/`（App.tsx、styles.css 等）
- **自动热重载**：保存文件后自动更新
- **无需重启应用**

#### 后端代码（Electron 主进程）
- **文件位置**：`src/main.ts`、`src/utils/`
- **需要手动重启**：按 `Ctrl+C` 停止，重新运行 `pnpm run electron-dev`

#### IPC 通信相关
- **文件位置**：`src/preload.ts`
- **需要手动重启**：修改 IPC 接口需要重启应用

### 3. 类型检查

```bash
# 检查 TypeScript 类型错误
pnpm run type-check

# 应在提交代码前运行
```

## 构建流程

### 1. 为生产环境准备

```bash
# 1. 检查类型
pnpm run type-check

# 2. 清理之前的构建（可选）
rm -rf dist release

# 3. 构建应用
pnpm run build
```

此命令会：
1. 编译 TypeScript（main.ts、utils/ 等）
2. 构建 React 前端（Vite build）
3. 打包 DMG 文件（electron-builder）

### 2. 构建输出

成功构建后，文件位置：
- **DMG 文件**：`release/ClawBot Launcher-1.0.0.dmg`
- **编译文件**：`dist/` 目录
- **应用 ZIP**：`release/ClawBot Launcher-1.0.0-mac.zip`

## 发布流程

### 1. 获取已构建的应用

```bash
# 列出 release 目录中的文件
ls -lh release/

# 应该看到类似以下输出：
# ClawBot Launcher-1.0.0.dmg
# ClawBot Launcher-1.0.0-mac.zip
```

### 2. 测试应用

```bash
# 挂载 DMG 文件
open release/ClawBot\ Launcher-1.0.0.dmg

# 双击运行应用（或从 Finder 中运行）
# 测试所有功能：
# - OpenClaw 启动/停止
# - Crabwalk 启动/停止
# - LaunchAgent 启用/禁用
# - 日志显示

# 卸载 DMG
hdiutil eject /Volumes/ClawBot\ Launcher
```

### 3. 分发应用

#### A. 直接发送 DMG 文件
```bash
# 用户下载后直接双击安装
```

#### B. 创建安装脚本
```bash
# 创建自动安装脚本（可选）
create_installer.sh
```

## 更新版本

### 1. 更新版本号

编辑 `package.json`：
```json
{
  "version": "1.1.0"  // 修改此版本号
}
```

### 2. 重建应用
```bash
pnpm run build
```

新的 DMG 文件会使用新的版本号。

## 常见问题

### Q1: 构建失败，提示找不到 React
**解决方案**：
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run build
```

### Q2: 在 M1/M2 Mac 上构建失败
**解决方案**：确保使用正确的 Node 版本
```bash
# 使用 nvm 切换到 18.x
nvm use 18
pnpm install
pnpm run build
```

### Q3: DMG 文件太大
**优化方案**：
- 在 `package.json` 的 `build` 配置中添加文件过滤
- 删除不必要的依赖
- 使用代码分割优化包大小

### Q4: 签名和公证（用于 App Store）
如果要在 App Store 发布，需要：
```json
{
  "build": {
    "mac": {
      "identity": "Your Developer ID",
      "certificateFile": "path/to/cert.p12",
      "certificatePassword": "password"
    }
  }
}
```

## 性能优化

### 1. 减小应用包大小

```bash
# 分析包大小（需要额外工具）
npm install -g source-map-explorer
pnpm run build:analyze
```

### 2. 代码分割

在 `vite.config.ts` 中配置：
```typescript
rollupOptions: {
  output: {
    manualChunks: {
      'react-vendor': ['react', 'react-dom'],
    }
  }
}
```

### 3. 预加载优化

减少预加载脚本中暴露的 API，只暴露必要的方法。

## 监视日志

### 应用日志
```bash
# 查看 LaunchAgent 日志
tail -f ~/.clawdbot-launcher.log
tail -f ~/.clawdbot-launcher-error.log

# 查看系统日志
log stream --predicate 'eventMessage contains "clawdbot"'
```

## 调试技巧

### 1. 开启详细日志

在 `src/main.ts` 中添加：
```typescript
console.log('应用启动信息...')
console.log('进程状态:', getProcessStatus())
```

### 2. 使用 Chrome DevTools

- Ctrl+Shift+I 打开 DevTools
- 在 Console 标签页调试
- 使用 Network 标签检查 IPC 通信

### 3. VSCode 调试配置

创建 `.vscode/launch.json`：
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/main.js",
      "preLaunchTask": "build"
    }
  ]
}
```

## 部署清单

部署前检查：
- [ ] 更新 `package.json` 中的版本号
- [ ] 运行 `pnpm run type-check` 确保无类型错误
- [ ] 在本地测试所有功能
- [ ] 执行 `pnpm run build` 创建生产版本
- [ ] 测试生成的 DMG 文件
- [ ] 验证 LaunchAgent 功能
- [ ] 更新 CHANGELOG.md（如有）
- [ ] 提交代码变更到 Git

## 参考资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Vite 官方文档](https://vitejs.dev)
- [React 官方文档](https://react.dev)
- [electron-builder 文档](https://www.electron.build)
