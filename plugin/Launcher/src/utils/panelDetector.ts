// @ts-nocheck
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

/**
 * 从项目配置文件动态读取端口
 */
function readProjectConfig(projectPath: string): { port?: number; host?: string } {
  try {
    // 尝试读取 package.json
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      const packageContent = fs.readFileSync(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(packageContent)
      
      // 从 scripts 中检测端口
      const devScript = packageJson.scripts?.dev || ''
      const portMatch = devScript.match(/--port\s+(\d+)/) || devScript.match(/-p\s+(\d+)/)
      if (portMatch) {
        return { port: parseInt(portMatch[1], 10), host: 'localhost' }
      }
    }

    // 尝试读取 vite.config.ts/js
    const viteConfigTs = path.join(projectPath, 'vite.config.ts')
    const viteConfigJs = path.join(projectPath, 'vite.config.js')
    const viteConfigPath = fs.existsSync(viteConfigTs) ? viteConfigTs : 
                          fs.existsSync(viteConfigJs) ? viteConfigJs : null
    
    if (viteConfigPath) {
      const viteContent = fs.readFileSync(viteConfigPath, 'utf-8')
      // 匹配 port: 5173 或 port:5173
      const portMatch = viteContent.match(/port[:\s]+(\d+)/)
      if (portMatch) {
        return { port: parseInt(portMatch[1], 10), host: 'localhost' }
      }
    }

    return {}
  } catch (error) {
    console.error('Error reading project config:', error)
    return {}
  }
}

/**
 * 从 ~/.openclaw/openclaw.json 读取 OpenClaw 配置
 */
function readOpenClawConfig() {
  const projectPath = path.join(os.homedir(), 'Desktop/github/clawdbot')
  
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    const configContent = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configContent)

    // 提取网关配置
    const port = config.gateway?.port || 18789
    const host = config.gateway?.host || '127.0.0.1'

    return { port, host, configPath, projectPath }
  } catch (error) {
    console.error('Error reading OpenClaw config:', error)
    return { 
      port: 18789, 
      host: '127.0.0.1',
      configPath: path.join(os.homedir(), '.openclaw', 'openclaw.json'),
      projectPath
    }
  }
}

/**
 * 动态获取 Crabwalk 项目配置
 */
function readCrabwalkConfig() {
  const projectPath = path.join(os.homedir(), 'Desktop/github/crabwalk')
  
  // 首先尝试从项目配置读取
  const projectConfig = readProjectConfig(projectPath)
  
  return {
    port: projectConfig.port || 5173, // Vite 默认端口
    host: projectConfig.host || 'localhost',
    projectPath
  }
}

/**
 * 尝试检测服务是否在特定端口上运行
 */
function detectServiceUrl(
  host: string,
  port: number,
  timeout: number = 2000
): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = port === 443 ? 'https' : 'http'
    const options = {
      hostname: host === 'localhost' ? '127.0.0.1' : host,
      port,
      method: 'HEAD',
      timeout,
    }

    const request = protocol === 'https' ? https.request : http.request

    const req = request(options, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500)
    })

    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })

    req.end()
  })
}

/**
 * 从进程输出中检测端口（通过解析进程信息）
 */
async function detectPortFromProcess(processName: string): Promise<number | null> {
  try {
    // 使用 lsof 或 netstat 检测进程占用的端口
    const cmd = process.platform === 'darwin' 
      ? `lsof -iTCP -sTCP:LISTEN -P -n | grep -i ${processName} || true`
      : `netstat -tlnp 2>/dev/null | grep -i ${processName} || true`
    
    const output = execSync(cmd, { encoding: 'utf-8', shell: '/bin/bash' })
    
    // 解析输出中的端口
    const portMatch = output.match(/:(\d+)/)
    if (portMatch) {
      return parseInt(portMatch[1], 10)
    }
  } catch (error) {
    // 命令失败，忽略错误
  }
  return null
}

/**
 * 扫描端口范围
 */
async function scanPorts(
  host: string, 
  ports: number[], 
  timeout: number = 2000
): Promise<{ port: number; found: boolean } | null> {
  for (const port of ports) {
    const found = await detectServiceUrl(host, port, timeout)
    if (found) {
      return { port, found: true }
    }
  }
  return null
}

/**
 * 带重试的端口检测
 */
async function detectWithRetry(
  detectFn: () => Promise<{ url: string | null; port: number | null; host: string; source: string } | null>,
  maxRetries: number = 10,
  delay: number = 1000
): Promise<{ url: string | null; port: number | null; host: string; source: string }> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await detectFn()
    if (result && result.url) {
      return result
    }
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  return { url: null, port: null, host: '127.0.0.1', source: 'fallback' }
}

/**
 * 检测 OpenClaw 面板 URL
 * 优先级：1. 从配置文件读取 2. 扫描常见端口 3. 返回配置的端口（fallback）
 */
async function detectOpenClawPanel() {
  try {
    // 从配置文件和项目配置读取
    const { port: configPort, host, configPath, projectPath } = readOpenClawConfig()
    
    // 也尝试从项目配置读取（以防配置文件过时）
    const projectConfig = readProjectConfig(projectPath)
    const effectivePort = projectConfig.port || configPort
    const effectiveHost = projectConfig.host || host

    // 首先验证配置/项目的端口是否确实在运行
    const isRunning = await detectServiceUrl(effectiveHost, effectivePort, 3000)
    if (isRunning) {
      return {
        url: `http://${effectiveHost}:${effectivePort}/chat?session=main`,
        port: effectivePort,
        host: effectiveHost,
        source: 'config',
      }
    }

    // 尝试从进程检测端口
    const processPort = await detectPortFromProcess('openclaw')
    if (processPort) {
      const isProcessRunning = await detectServiceUrl(effectiveHost, processPort, 2000)
      if (isProcessRunning) {
        return {
          url: `http://${effectiveHost}:${processPort}/chat?session=main`,
          port: processPort,
          host: effectiveHost,
          source: 'detected',
        }
      }
    }

    // 如果没有运行，尝试扫描常见端口作为后备
    const possiblePorts = [18789, 3000, 8000, 8001, 9000, 8080]
    const scanResult = await scanPorts('127.0.0.1', possiblePorts, 2000)
    
    if (scanResult) {
      return {
        url: `http://127.0.0.1:${scanResult.port}/chat?session=main`,
        port: scanResult.port,
        host: '127.0.0.1',
        source: 'detected',
      }
    }

    // 返回配置的端口作为最后的回退
    return {
      url: `http://${effectiveHost}:${effectivePort}/chat?session=main`,
      port: effectivePort,
      host: effectiveHost,
      source: 'fallback',
    }
  } catch (error) {
    console.error('Error detecting OpenClaw panel:', error)
    return {
      url: 'http://127.0.0.1:18789/chat?session=main',
      port: 18789,
      host: '127.0.0.1',
      source: 'fallback',
    }
  }
}

/**
 * 检测 Crabwalk 面板 URL
 * 动态从项目配置读取端口并扫描
 */
async function detectCrabwalkPanel() {
  try {
    // 从项目配置读取
    const { port: configPort, host, projectPath } = readCrabwalkConfig()
    
    // 验证配置的端口是否确实在运行
    const isRunning = await detectServiceUrl(host, configPort, 3000)
    if (isRunning) {
      return {
        url: `http://${host}:${configPort}`,
        port: configPort,
        host,
        source: 'config',
      }
    }

    // 尝试从进程检测端口
    const processPort = await detectPortFromProcess('crabwalk')
    if (processPort) {
      const isProcessRunning = await detectServiceUrl(host, processPort, 2000)
      if (isProcessRunning) {
        return {
          url: `http://${host}:${processPort}`,
          port: processPort,
          host,
          source: 'detected',
        }
      }
    }

    // 扫描常见端口（包括 Vite 默认端口）
    const possiblePorts = [5173, 3000, 8080, 8000, 8001, 9000, 4173]
    const scanResult = await scanPorts(host, possiblePorts, 2000)
    
    if (scanResult) {
      return {
        url: `http://${host}:${scanResult.port}`,
        port: scanResult.port,
        host,
        source: 'detected',
      }
    }

    // 回退到项目配置的端口
    return {
      url: `http://${host}:${configPort}`,
      port: configPort,
      host,
      source: 'fallback',
    }
  } catch (error) {
    console.error('Error detecting Crabwalk panel:', error)
    return {
      url: 'http://localhost:5173',
      port: 5173,
      host: 'localhost',
      source: 'fallback',
    }
  }
}

/**
 * 等待服务启动并检测端口（带轮询）
 */
async function waitForService(
  serviceName,
  maxWaitMs = 30000,
  checkIntervalMs = 1000
) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = serviceName === 'openclaw' 
        ? await detectOpenClawPanel()
        : await detectCrabwalkPanel()
      
      if (result.url && result.source !== 'fallback') {
        return {
          success: true,
          url: result.url,
          port: result.port || undefined,
          host: result.host,
          source: result.source,
        }
      }
    } catch (error) {
      // 忽略错误，继续轮询
    }
    
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs))
  }
  
  // 超时，返回 fallback
  const fallback = serviceName === 'openclaw'
    ? { url: 'http://127.0.0.1:18789/chat?session=main', port: 18789, host: '127.0.0.1' }
    : { url: 'http://localhost:5173', port: 5173, host: 'localhost' }
    
  return {
    success: false,
    error: '服务启动超时',
    ...fallback,
    source: 'fallback',
  }
}

module.exports = {
  readOpenClawConfig,
  readCrabwalkConfig,
  detectOpenClawPanel,
  detectCrabwalkPanel,
  waitForService
}
