// @ts-nocheck
const { spawn } = require('child_process')
const path = require('path')
const os = require('os')
const fs = require('fs')

function readGatewayTokenFromOpenClawConfig() {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    if (!fs.existsSync(configPath)) {
      return ''
    }

    const content = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content)

    const token =
      config?.gateway?.auth?.token ||
      config?.gateway?.token ||
      config?.auth?.token ||
      ''

    return typeof token === 'string' ? token.trim() : ''
  } catch {
    return ''
  }
}

// 启动 OpenClaw
async function startOpenClaw(options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const openclawDir = path.join(os.homedir(), 'Desktop/github/clawdbot')
      const envPath = `/opt/homebrew/opt/node@20/bin:/usr/local/bin:/usr/bin:${process.env.PATH || ''}`
      const configuredToken = typeof options.gatewayToken === 'string' ? options.gatewayToken.trim() : ''
      const fallbackToken = readGatewayTokenFromOpenClawConfig()
      const gatewayToken = configuredToken || fallbackToken
      const modelProvider = options.modelProvider === 'local' ? 'local' : 'minimax'
      const minimaxApiKey = typeof options.minimaxApiKey === 'string' ? options.minimaxApiKey.trim() : ''
      const minimaxModel = typeof options.minimaxModel === 'string' ? options.minimaxModel.trim() : ''
      const localBaseUrl = typeof options.localBaseUrl === 'string' ? options.localBaseUrl.trim() : ''
      const localModelName = typeof options.localModelName === 'string' ? options.localModelName.trim() : ''
      const localApiKey = typeof options.localApiKey === 'string' ? options.localApiKey.trim() : ''
      const proc = spawn('/usr/bin/env', ['node', 'openclaw.mjs'], {
        cwd: openclawDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env: {
          ...process.env,
          PATH: envPath,
          OPENCLAW_MODEL_PROVIDER: modelProvider,
          OPENCLAW_DEFAULT_MODEL_PROVIDER: modelProvider,
          ...(gatewayToken
            ? {
                OPENCLAW_GATEWAY_TOKEN: gatewayToken,
                GATEWAY_TOKEN: gatewayToken,
                CONTROL_UI_GATEWAY_TOKEN: gatewayToken,
              }
            : {}),
          ...(modelProvider === 'minimax'
            ? {
                ...(minimaxApiKey
                  ? {
                      MINIMAX_API_KEY: minimaxApiKey,
                      OPENCLAW_MINIMAX_API_KEY: minimaxApiKey,
                    }
                  : {}),
                ...(minimaxModel
                  ? {
                      MINIMAX_MODEL: minimaxModel,
                      OPENCLAW_MINIMAX_MODEL: minimaxModel,
                      OPENCLAW_DEFAULT_MODEL: minimaxModel,
                    }
                  : {}),
              }
            : {}),
          ...(modelProvider === 'local'
            ? {
                ...(localBaseUrl
                  ? {
                      OPENAI_BASE_URL: localBaseUrl,
                      OPENCLAW_LOCAL_BASE_URL: localBaseUrl,
                    }
                  : {}),
                ...(localModelName
                  ? {
                      OPENAI_MODEL: localModelName,
                      OPENCLAW_LOCAL_MODEL: localModelName,
                      OPENCLAW_DEFAULT_MODEL: localModelName,
                    }
                  : {}),
                ...(localApiKey
                  ? {
                      OPENAI_API_KEY: localApiKey,
                      OPENCLAW_LOCAL_API_KEY: localApiKey,
                    }
                  : {}),
              }
            : {}),
        },
      })

      proc.on('error', (error) => {
        reject(new Error(`启动 OpenClaw 失败: ${error.message}`))
      })

      // 给进程一点时间启动
      setTimeout(() => {
        if (!proc.killed) {
          resolve(proc)
        } else {
          reject(new Error('OpenClaw 进程在启动后立即退出'))
        }
      }, 1000)
    } catch (error) {
      reject(error)
    }
  })
}

// 启动 Crabwalk
async function startCrabwalk() {
  return new Promise((resolve, reject) => {
    try {
      const crabwalkDir = path.join(os.homedir(), 'Desktop/github/crabwalk')
      
      // 使用 npm run dev 替代 pnpm dev，因为 pnpm 在子进程中可能不可用
      const proc = spawn('npm', ['run', 'dev'], {
        cwd: crabwalkDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        shell: true,  // 在 shell 中运行以确保 npm 命令可用
        env: {
          ...process.env,
          PATH: `/opt/homebrew/opt/node@20/bin:${process.env.PATH || ''}`,
        },
      })

      proc.on('error', (error) => {
        reject(new Error(`启动 Crabwalk 失败: ${error.message}`))
      })

      // 给进程时间启动并启动开发服务器（增加到 3 秒用于 npm 启动）
      setTimeout(() => {
        if (!proc.killed) {
          resolve(proc)
        } else {
          reject(new Error('Crabwalk 进程在启动后立即退出'))
        }
      }, 3000)
    } catch (error) {
      reject(error)
    }
  })
}

// 停止进程
function stopProcess(process) {
  if (process && !process.killed) {
    process.kill('SIGTERM')
    
    // 如果 5 秒后还没杀死，强制杀死
    setTimeout(() => {
      if (process && !process.killed) {
        process.kill('SIGKILL')
      }
    }, 5000)
  }
}

// 获取进程状态
function getProcessStatus(process) {
  return process !== null && !process.killed
}

module.exports = {
  startOpenClaw,
  startCrabwalk,
  stopProcess,
  getProcessStatus
}
