// @ts-nocheck
const os = require('os')
const path = require('path')
const fs = require('fs').promises
const { execSync } = require('child_process')

const LAUNCH_AGENT_NAME = 'com.clawdbot.launcher'
const LAUNCH_AGENT_DIR = path.join(os.homedir(), 'Library/LaunchAgents')
const LAUNCH_AGENT_PATH = path.join(LAUNCH_AGENT_DIR, `${LAUNCH_AGENT_NAME}.plist`)

// 获取应用路径
function getAppPath(): string {
  // 在开发环境中，应用在 /path/to/clawdbot/plugin/Launcher
  // 在生产环境中，应用会在 /Applications 或其他位置
  return process.env.LAUNCHER_PATH || process.resourcesPath || ''
}

// 生成 plist 内容
function generatePlist(launcherPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LAUNCH_AGENT_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${launcherPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>\${HOME}/.clawdbot-launcher.log</string>
    <key>StandardErrorPath</key>
    <string>\${HOME}/.clawdbot-launcher-error.log</string>
</dict>
</plist>`
}

// 创建 LaunchAgent
async function createLaunchAgent() {
  try {
    // 确保目录存在
    await fs.mkdir(LAUNCH_AGENT_DIR, { recursive: true })

    const appPath = getAppPath()
    if (!appPath) {
      throw new Error('无法获取应用路径')
    }

    const plistContent = generatePlist(appPath)
    await fs.writeFile(LAUNCH_AGENT_PATH, plistContent)

    // 加载 LaunchAgent
    try {
      execSync(`launchctl load "${LAUNCH_AGENT_PATH}"`)
    } catch (error) {
      // 如果已经加载过，会抛出错误，这是正常的
      console.log('LaunchAgent 可能已加载')
    }

    console.log('LaunchAgent 已创建并加载')
  } catch (error) {
    console.error('创建 LaunchAgent 失败:', error)
    throw error
  }
}

// 删除 LaunchAgent
async function removeLaunchAgent() {
  try {
    // 卸载 LaunchAgent
    try {
      execSync(`launchctl unload "${LAUNCH_AGENT_PATH}"`)
    } catch (error) {
      console.log('卸载 LaunchAgent 失败或未加载')
    }

    // 删除文件
    await fs.rm(LAUNCH_AGENT_PATH, { force: true })
    console.log('LaunchAgent 已删除')
  } catch (error) {
    console.error('删除 LaunchAgent 失败:', error)
    throw error
  }
}

// 检查 LaunchAgent 是否启用
async function isLaunchAgentEnabled() {
  try {
    const exists = await fs
      .access(LAUNCH_AGENT_PATH)
      .then(() => true)
      .catch(() => false)
    return exists
  } catch (error) {
    console.error('检查 LaunchAgent 失败:', error)
    return false
  }
}

module.exports = {
  createLaunchAgent,
  removeLaunchAgent,
  isLaunchAgentEnabled
}
