#!/bin/bash

# ClawBot Launcher Development Setup Script

echo "🚀 ClawBot Launcher - Development Setup"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

echo "✓ Node.js version: $(node --version)"
echo "✓ pnpm version: $(pnpm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo ""
    echo "📝 Creating .env.local..."
    cp .env.example .env.local
    echo "✓ .env.local created (update paths if necessary)"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Available commands:"
echo "  pnpm run dev           - Start development server"
echo "  pnpm run electron-dev  - Start Electron in development mode"
echo "  pnpm run build         - Build and package for production"
echo "  pnpm run type-check    - Check TypeScript types"
echo ""
echo "To start developing:"
echo "  pnpm run electron-dev"
