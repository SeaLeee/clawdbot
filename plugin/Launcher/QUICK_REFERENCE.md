# ClawBot Launcher - 快速参考

## 📦 项目文件清单

```
✅ 核心文件
├── src/
│   ├── main.ts                  ✅ Electron 主进程
│   ├── preload.ts               ✅ IPC 预加载脚本
│   ├── types.ts                 ✅ TypeScript 类型定义
│   ├── utils/
│   │   ├── launchAgent.ts        ✅ macOS 启动配置
│   │   └── processManager.ts     ✅ 进程管理
│   └── renderer/
│       ├── index.html           ✅ HTML 入口
│       ├── main.tsx             ✅ React 入口
│       ├── App.tsx              ✅ 主应用组件
│       ├── vite-env.d.ts        ✅ 环境类型定义
│       └── styles.css           ✅ 样式表

✅ 配置文件
├── package.json                 ✅ 项目配置
├── tsconfig.json                ✅ TypeScript 配置
├── tsconfig.node.json           ✅ Node TypeScript 配置
└── vite.config.ts               ✅ Vite 构建配置

✅ 文档文件
├── README.md                    ✅ 项目说明
├── QUICK_START.md               ✅ 快速开始指南
├── DEVELOPMENT.md               ✅ 开发发布指南
├── PROJECT_SUMMARY.md           ✅ 项目完成总结
└── QUICK_REFERENCE.md           ✅ 本文件

✅ 工具脚本
├── setup.sh                     ✅ 自动设置脚本
└── .env.example                 ✅ 环境变量示例

✅ 其他
└── .gitignore                   ✅ Git 忽略配置
```

## 🎯 功能概览

```
┌─────────────────────────────────────────────────────────┐
│         ClawBot Launcher GUI                            │
├─────────────────────────────────────────────────────────┤
│  启动器          │ 设置           │ 日志              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐             │
│  │   OpenClaw      │  │   LaunchAgent   │             │
│  │ ├─ 启动 ├─ 状态 │  │ ├─ 启用         │             │
│  │ ├─ 停止 │ (运行)│  │ ├─ 禁用         │             │
│  │ └─────────────────┘  │ └─────────────────┘             │
│                                                         │
│  ┌─────────────────┐     关于信息                       │
│  │  Crabwalk       │     版本：1.0.0                    │
│  │ ├─ 启动 ├─ 状态 │     路径：...                      │
│  │ ├─ 停止 │(已停) │                                   │
│  │ └─────────────────┘     日志显示                      │
│                           [2026-02-24 ...]             │
│  状态消息区域              [启动 OpenClaw...]           │
│  ✓ OpenClaw 已启动        [启用 LaunchAgent...]        │
└─────────────────────────────────────────────────────────┘
```

## 🚀 常用命令速查

### 开发命令
```bash
# 完整开发环境启动
pnpm run electron-dev

# 仅启动前端开发服务器
pnpm run dev

# 仅启动 Electron（需要先启动 dev）
pnpm run electron

# 类型检查（提交前必运行）
pnpm run type-check
```

### 生产命令
```bash
# 完整构建和打包
pnpm run build

# 预览生产构建
pnpm run preview
```

### 初始化命令
```bash
# 自动设置（推荐）
bash setup.sh

# 手动安装依赖
pnpm install
```

## 📂 路径快速参考

```
Launcher 项目位置
└── /path/to/clawdbot/plugin/Launcher

启动的服务位置
├── OpenClaw: /path/to/clawdbot
└── Crabwalk: /path/to/crabwalk

LaunchAgent 配置
└── ~/Library/LaunchAgents/com.clawdbot.launcher.plist

日志文件
├── ~/.clawdbot-launcher.log         # 标准输出
└── ~/.clawdbot-launcher-error.log   # 错误输出

构建输出
├── dist/                            # 编译输出
├── dist/renderer/                   # 前端输出
└── release/                         # DMG 文件

所有其他输出文件
```

## 🔌 IPC 接口速查

### 可用的 IPC 调用列表

```typescript
// 启动管理
startOpenClaw()              // 启动 OpenClaw
startCrabwalk()              // 启动 Crabwalk
stopProcess(name)            // 停止指定进程

// 状态查询
getProcessStatus()           // 获取所有进程状态
getPaths()                   // 获取应用路径信息

// LaunchAgent 管理
checkLaunchAgent()           // 检查是否已启用
enableLaunchAgent()          // 启用开机启动
disableLaunchAgent()         // 禁用开机启动
```

## 🛠️ 常见操作速查

### 启动应用
```bash
cd ~/Desktop/github/clawdbot/plugin/Launcher
pnpm run electron-dev
```

### 查看日志
```bash
# 应用内日志
# 打开"日志"标签页

# 系统日志
tail -f ~/.clawdbot-launcher-error.log
```

### 检查各服务
```bash
# 检查 OpenClaw 目录
ls ~/Desktop/github/clawdbot/openclaw.mjs

# 检查 Crabwalk 目录
ls ~/Desktop/github/crabwalk/package.json

# 检查 LaunchAgent
ls ~/Library/LaunchAgents/com.clawdbot.launcher.plist
```

### 重置应用
```bash
cd ~/Desktop/github/clawdbot/plugin/Launcher

# 清理缓存
rm -rf node_modules dist release dist pnpm-lock.yaml

# 重新安装
pnpm install

# 重新启动
pnpm run electron-dev
```

## 🐛 快速问题排查

### "无法启动 OpenClaw"
✅ 解决步骤：
1. 检查路径：`ls ~/Desktop/github/clawdbot/`
2. 查看日志：应用 → 日志标签页
3. 尝试手动启动：`cd ~/Desktop/github/clawdbot && node openclaw.mjs`

### "无法启动 Crabwalk"
✅ 解决步骤：
1. 检查路径：`ls ~/Desktop/github/crabwalk/`
2. 安装依赖：`cd ~/Desktop/github/crabwalk && pnpm install`
3. 尝试手动启动：`cd ~/Desktop/github/crabwalk && pnpm dev`

### "开机启动不工作"
✅ 解决步骤：
1. 禁用：设置 → 开机自动启动 → 已禁用
2. 启用：设置 → 开机自动启动 → 已启用
3. 验证：`launchctl list | grep clawdbot`

### "应用频繁崩溃"
✅ 解决步骤：
1. 清理依赖：`rm -rf node_modules pnpm-lock.yaml`
2. 重新安装：`pnpm install`
3. 重启应用：`pnpm run electron-dev`

## 📋 开发检查清单

部署前必检项：

- [ ] 运行 `pnpm run type-check` - 无类型错误
- [ ] 本地测试：启动/停止 OpenClaw
- [ ] 本地测试：启动/停止 Crabwalk
- [ ] 本地测试：启用/禁用 LaunchAgent
- [ ] 查看日志：无错误信息
- [ ] 执行 `pnpm run build` - 构建成功
- [ ] 测试 DMG 文件：能正常安装和运行
- [ ] 构建输出：`release/*.dmg` 存在

## 📚 完整文档索引

| 文档 | 用途 | 链接 |
|------|------|------|
| **README.md** | 项目完整说明 | 项目根目录 |
| **QUICK_START.md** | 快速开始指南 | 项目根目录 |
| **DEVELOPMENT.md** | 开发和发布指南 | 项目根目录 |
| **PROJECT_SUMMARY.md** | 项目完成总结 | 项目根目录 |
| **QUICK_REFERENCE.md** | 快速参考（本文件） | 项目根目录 |

## 💡 提示和技巧

### 开发效率
- 使用 `Ctrl+Shift+I` 打开 DevTools 进行调试
- 修改 React 文件后会自动热更新
- 修改 Electron 主进程文件后需要重启应用

### 调试技巧
- 在 `src/main.ts` 中使用 `console.log()` 打印主进程信息
- 在 React 组件中直接使用浏览器 DevTools 调试
- 查看日志标签页了解应用运行流程

### 性能优化
- 构建前检查依赖大小
- 定期清理过期的日志
- 在设置中禁用不需要的功能

## ❓ 快速答疑

**Q: 如何修改启动的服务路径？**  
A: 编辑 `src/utils/processManager.ts` 中的 `startOpenClaw()` 和 `startCrabwalk()` 函数

**Q: 如何修改应用名称？**  
A: 编辑 `package.json` 中的 `name` 和 `build.productName` 字段

**Q: 能在 Windows 上运行吗？**  
A: 当前针对 macOS 优化。Windows 支持需要修改路径和 LaunchAgent 改为任务计划程序

**Q: 能添加自定义命令吗？**  
A: 可以。编辑 `src/renderer/App.tsx` 和 `src/main.ts` 添加新的 IPC 接口

**Q: 如何分发应用？**  
A: 执行 `pnpm run build` 生成 DMG 文件，分发即可

---

**最后更新**：2026年2月24日  
**版本**：1.0.0  
**状态**：✅ 完成并可用
