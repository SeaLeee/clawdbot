// @ts-nocheck
/**
 * 项目默认配置读取模块
 * 从 ~/.openclaw/openclaw.json 等项目级配置文件中读取默认值
 * 当用户未在 UI 中填写时，作为 fallback 使用
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

export interface ProjectDefaults {
  gatewayToken: string
  minimaxApiKey: string
  minimaxModel: string
  localBaseUrl: string
  localModelName: string
  localApiKey: string
  modelProvider: 'minimax' | 'local' | ''
  /** 标记每个字段的来源 */
  sources: {
    gatewayToken: string
    minimaxApiKey: string
    minimaxModel: string
    localBaseUrl: string
    localModelName: string
    localApiKey: string
    modelProvider: string
  }
}

/**
 * 从 ~/.openclaw/openclaw.json 读取项目默认配置
 */
function readOpenClawConfig(): Record<string, unknown> | null {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    if (!fs.existsSync(configPath)) {
      return null
    }
    const content = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 从 clawdbot 项目 .env 文件读取环境变量
 */
function readEnvFile(): Record<string, string> {
  const envVars: Record<string, string> = {}
  try {
    const envPaths = [
      path.join(os.homedir(), 'Desktop/github/clawdbot', '.env'),
      path.join(os.homedir(), 'Desktop/github/clawdbot', '.env.local'),
    ]
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8')
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=')
            if (eqIndex > 0) {
              const key = trimmed.substring(0, eqIndex).trim()
              const value = trimmed.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
              envVars[key] = value
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return envVars
}

/**
 * 获取项目默认配置
 * 优先级：.env.local > .env > ~/.openclaw/openclaw.json > 空
 */
function getProjectDefaults(): ProjectDefaults {
  const defaults: ProjectDefaults = {
    gatewayToken: '',
    minimaxApiKey: '',
    minimaxModel: '',
    localBaseUrl: '',
    localModelName: '',
    localApiKey: '',
    modelProvider: '',
    sources: {
      gatewayToken: '',
      minimaxApiKey: '',
      minimaxModel: '',
      localBaseUrl: '',
      localModelName: '',
      localApiKey: '',
      modelProvider: '',
    },
  }

  // 1. 从 openclaw.json 读取
  const openclawConfig = readOpenClawConfig() as Record<string, Record<string, unknown>> | null
  if (openclawConfig) {
    // Gateway Token
    const gateway = openclawConfig?.gateway as Record<string, unknown> | undefined
    const auth = (gateway?.auth || openclawConfig?.auth) as Record<string, unknown> | undefined
    const gwToken = (auth?.token || gateway?.token || '') as string
    if (gwToken) {
      defaults.gatewayToken = String(gwToken).trim()
      defaults.sources.gatewayToken = 'openclaw.json'
    }

    // 从 models.providers 中读取 minimax 配置
    const models = openclawConfig?.models as Record<string, unknown> | undefined
    const providers = models?.providers as Record<string, Record<string, unknown>> | undefined
    const minimaxProvider = providers?.['minimax-cn']
    if (minimaxProvider) {
      defaults.sources.minimaxModel = 'openclaw.json'
    }

    // 从 models.providers 中读取 lmstudio/local 配置
    const lmstudioProvider = providers?.lmstudio
    if (lmstudioProvider) {
      if (lmstudioProvider.baseUrl) {
        defaults.localBaseUrl = String(lmstudioProvider.baseUrl)
        defaults.sources.localBaseUrl = 'openclaw.json'
      }
      if (lmstudioProvider.apiKey) {
        defaults.localApiKey = String(lmstudioProvider.apiKey)
        defaults.sources.localApiKey = 'openclaw.json'
      }
      const lmModels = lmstudioProvider.models as Array<Record<string, unknown>> | undefined
      if (lmModels && lmModels.length > 0) {
        defaults.localModelName = String(lmModels[0].id)
        defaults.sources.localModelName = 'openclaw.json'
      }
    }

    // 检测默认模型提供商
    const agents = openclawConfig?.agents as Record<string, unknown> | undefined
    const agentDefaults = agents?.defaults as Record<string, unknown> | undefined
    const model = agentDefaults?.model as Record<string, unknown> | undefined
    const primaryModel = String(model?.primary || '')
    if (primaryModel.startsWith('lmstudio/') || primaryModel.startsWith('local/')) {
      defaults.modelProvider = 'local'
      defaults.sources.modelProvider = 'openclaw.json'
    } else if (primaryModel.startsWith('minimax')) {
      defaults.modelProvider = 'minimax'
      defaults.sources.modelProvider = 'openclaw.json'
    }
  }

  // 2. 从 .env 文件覆盖
  const envVars = readEnvFile()
  if (envVars.OPENCLAW_GATEWAY_TOKEN || envVars.GATEWAY_TOKEN) {
    defaults.gatewayToken = envVars.OPENCLAW_GATEWAY_TOKEN || envVars.GATEWAY_TOKEN || defaults.gatewayToken
    defaults.sources.gatewayToken = '.env'
  }
  if (envVars.MINIMAX_API_KEY || envVars.OPENCLAW_MINIMAX_API_KEY) {
    defaults.minimaxApiKey = envVars.MINIMAX_API_KEY || envVars.OPENCLAW_MINIMAX_API_KEY || defaults.minimaxApiKey
    defaults.sources.minimaxApiKey = '.env'
  }
  if (envVars.MINIMAX_MODEL || envVars.OPENCLAW_MINIMAX_MODEL) {
    defaults.minimaxModel = envVars.MINIMAX_MODEL || envVars.OPENCLAW_MINIMAX_MODEL || defaults.minimaxModel
    defaults.sources.minimaxModel = '.env'
  }
  if (envVars.OPENAI_BASE_URL || envVars.OPENCLAW_LOCAL_BASE_URL) {
    defaults.localBaseUrl = envVars.OPENAI_BASE_URL || envVars.OPENCLAW_LOCAL_BASE_URL || defaults.localBaseUrl
    defaults.sources.localBaseUrl = '.env'
  }
  if (envVars.OPENAI_MODEL || envVars.OPENCLAW_LOCAL_MODEL) {
    defaults.localModelName = envVars.OPENAI_MODEL || envVars.OPENCLAW_LOCAL_MODEL || defaults.localModelName
    defaults.sources.localModelName = '.env'
  }
  if (envVars.OPENAI_API_KEY || envVars.OPENCLAW_LOCAL_API_KEY) {
    defaults.localApiKey = envVars.OPENAI_API_KEY || envVars.OPENCLAW_LOCAL_API_KEY || defaults.localApiKey
    defaults.sources.localApiKey = '.env'
  }

  // 3. 从当前进程环境变量补充（最高优先级）
  if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    defaults.gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN
    defaults.sources.gatewayToken = '环境变量'
  }
  if (process.env.MINIMAX_API_KEY) {
    defaults.minimaxApiKey = process.env.MINIMAX_API_KEY
    defaults.sources.minimaxApiKey = '环境变量'
  }

  return defaults
}

/**
 * 获取有效值：用户配置优先，未填写则使用项目默认
 */
function getEffectiveValue(userValue: string, defaultValue: string): { value: string; source: 'user' | 'project' | 'none' } {
  const trimmedUser = typeof userValue === 'string' ? userValue.trim() : ''
  const trimmedDefault = typeof defaultValue === 'string' ? defaultValue.trim() : ''
  
  if (trimmedUser) {
    return { value: trimmedUser, source: 'user' }
  }
  if (trimmedDefault) {
    return { value: trimmedDefault, source: 'project' }
  }
  return { value: '', source: 'none' }
}

module.exports = {
  getProjectDefaults,
  getEffectiveValue,
}
