// @ts-nocheck
/**
 * 自动启动配置管理模块
 * 支持浏览器(localStorage)和Electron(文件系统)双模式
 */

const LOCAL_STORAGE_KEY = 'clawdbot-launcher-config'

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  launchAgentEnabled: false,
  autoStartOpenClaw: false,
  autoStartCrabwalk: false,
  autoOpenOpenClawPanel: false,
  autoOpenCrabwalkPanel: false,
  openclawGatewayToken: '',
  openclawModelProvider: 'minimax',
  openclawMinimaxApiKey: '',
  openclawMinimaxModel: 'MiniMax-M1',
  openclawLocalBaseUrl: 'http://127.0.0.1:11434/v1',
  openclawLocalModelName: '',
  openclawLocalApiKey: '',
  startMinimized: false,
  version: '1.0.0',
}

/**
 * 检测是否有 Node.js 文件系统访问权限（Electron环境）
 */
function hasFileSystemAccess(): boolean {
  try {
    // 检查是否在 Node 环境
    return typeof process !== 'undefined' && 
           process.versions != null &&
           typeof process.versions.node !== 'undefined'
  } catch {
    return false
  }
}

/**
 * 从 localStorage 读取配置
 */
function readFromLocalStorage(): AutoStartConfig | null {
  try {
      if (typeof localStorage === 'undefined') {
        return null
      }
    const content = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!content) {
        return null
      }
    const config = JSON.parse(content) as AutoStartConfig
    return { ...DEFAULT_CONFIG, ...config }
  } catch (error) {
    console.error('从 localStorage 读取配置失败:', error)
    return null
  }
}

/**
 * 保存到 localStorage
 */
function saveToLocalStorage(config: AutoStartConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config))
    }
  } catch (error) {
    console.error('保存到 localStorage 失败:', error)
  }
}

/**
 * 从文件系统读取配置（仅 Node/Electron）
 */
async function readFromFileSystem(): Promise<AutoStartConfig | null> {
  if (!hasFileSystemAccess()) {
    return null
  }
  
  try {
    // 动态导入 Node.js 模块
    const os = await import('os')
    const path = await import('path')
    const fs = await import('fs/promises')
    
    const CONFIG_DIR = path.join(os.homedir(), '.clawdbot-launcher')
    const CONFIG_FILE = path.join(CONFIG_DIR, 'autostart.json')
    
    const content = await fs.readFile(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(content) as AutoStartConfig
    return { ...DEFAULT_CONFIG, ...config }
  } catch {
    // 配置文件不存在或读取失败
    return null
  }
}

/**
 * 保存到文件系统（仅 Node/Electron）
 */
async function saveToFileSystem(config: AutoStartConfig): Promise<void> {
  if (!hasFileSystemAccess()) {
    return
  }
  
  try {
    // 动态导入 Node.js 模块
    const os = await import('os')
    const path = await import('path')
    const fs = await import('fs/promises')
    
    const CONFIG_DIR = path.join(os.homedir(), '.clawdbot-launcher')
    const CONFIG_FILE = path.join(CONFIG_DIR, 'autostart.json')
    
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('保存到文件系统失败:', error)
  }
}

/**
 * 读取自动启动配置
 * 优先从文件系统读取（Electron），否则从 localStorage 读取（浏览器）
 */
async function readAutoStartConfig() {
  // 尝试从文件系统读取（Electron 环境）
  const fileConfig = await readFromFileSystem()
    if (fileConfig) {
      return fileConfig
    }
  
  // 从 localStorage 读取（浏览器环境）
  const localConfig = readFromLocalStorage()
    if (localConfig) {
      return localConfig
    }
  
  // 返回默认配置
  return { ...DEFAULT_CONFIG }
}

/**
 * 保存自动启动配置
 * 同时保存到文件系统（Electron）和 localStorage（浏览器）
 */
async function saveAutoStartConfig(config) {
  const currentConfig = await readAutoStartConfig()
  const newConfig = { ...currentConfig, ...config }
  
  // 保存到文件系统（Electron 环境）
  await saveToFileSystem(newConfig)
  
  // 始终保存到 localStorage（浏览器环境 + 作为备份）
  saveToLocalStorage(newConfig)
  
  return newConfig
}

/**
 * 重置为默认配置
 */
async function resetAutoStartConfig() {
  // 清除文件系统配置
  if (hasFileSystemAccess()) {
    try {
      const os = await import('os')
      const path = await import('path')
      const fs = await import('fs/promises')
      
      const CONFIG_DIR = path.join(os.homedir(), '.clawdbot-launcher')
      const CONFIG_FILE = path.join(CONFIG_DIR, 'autostart.json')
      
      await fs.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2))
    } catch (error) {
      console.error('重置文件系统配置失败:', error)
    }
  }
  
  // 清除 localStorage
  saveToLocalStorage(DEFAULT_CONFIG)
  
  return { ...DEFAULT_CONFIG }
}

/**
 * 获取配置文件路径（用于显示）
 */
function getConfigFilePath() {
  if (hasFileSystemAccess()) {
    try {
      // 同步获取路径（仅在 Node 环境）
      const os = require('os')
      const path = require('path')
      return path.join(os.homedir(), '.clawdbot-launcher', 'autostart.json')
    } catch {
      return '~/.clawdbot-launcher/autostart.json'
    }
  }
  return `localStorage (${LOCAL_STORAGE_KEY})`
}

/**
 * 导出存储模式供调试
 */
function getStorageMode() {
  if (hasFileSystemAccess()) {
    return 'filesystem'
  }
  if (typeof localStorage !== 'undefined') {
    return 'localStorage'
  }
  return 'none'
}

module.exports = {
  DEFAULT_CONFIG,
  readAutoStartConfig,
  saveAutoStartConfig,
  resetAutoStartConfig,
  getConfigFilePath,
  getStorageMode
}
