#!/bin/bash
# 构建 macOS 应用程序脚本

set -e

echo "🚀 开始构建 ClawBot Launcher macOS 应用..."

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未找到 Node.js"
    echo "请先安装 Node.js 22+: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "⚠️  警告：Node.js 版本低于 22，尝试使用 Homebrew 的 Node 22..."
    
    # 尝试使用 Homebrew 的 Node 22
    if [ -d "/opt/homebrew/Cellar/node@22" ]; then
        NODE_22_PATH=$(ls -1 /opt/homebrew/Cellar/node@22/*/bin/node 2>/dev/null | head -1)
        if [ -n "$NODE_22_PATH" ]; then
            export PATH="$(dirname $NODE_22_PATH):$PATH"
            echo "✅ 已切换到 Node 22: $(node --version)"
        else
            echo "❌ 错误：未找到 Node.js 22"
            exit 1
        fi
    else
        echo "❌ 错误：需要 Node.js 22+"
        exit 1
    fi
fi

echo "✅ Node.js 版本: $(node --version)"

# 安装依赖
echo "📦 安装依赖..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    echo "❌ 错误：未找到 pnpm 或 npm"
    exit 1
fi

# 构建应用
echo "🔨 构建应用..."
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi

# 检查结果
if [ -d "release/mac" ]; then
    echo ""
    echo "✅ 构建成功！"
    echo ""
    echo "📱 应用位置:"
    echo "   - 未签名版本: $(pwd)/release/mac/ClawBot Launcher.app"
    if [ -f "release/ClawBot Launcher-1.0.0.dmg" ]; then
        echo "   - DMG 安装包: $(pwd)/release/ClawBot Launcher-1.0.0.dmg"
    fi
    echo ""
    echo "🚀 运行应用:"
    echo "   open 'release/mac/ClawBot Launcher.app'"
    echo ""
    echo "⚠️  首次运行可能需要右键打开（避免 Gatekeeper）"
    echo "   或运行: xattr -rd com.apple.quarantine 'release/mac/ClawBot Launcher.app'"
else
    echo "❌ 构建失败"
    exit 1
fi
