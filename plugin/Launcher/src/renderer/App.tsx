import React, { useState, useEffect } from 'react'
import './styles.css'
import { Rocket, Settings, Play, Square, Power, ExternalLink, Clock, Monitor, ChevronRight, RotateCcw, Database } from 'lucide-react'

interface ActionResult {
  success: boolean
  message?: string
  error?: string
}

interface LaunchAgentStatus {
  enabled: boolean
  message?: string
}

interface ServiceStartedData {
  name: 'openclaw' | 'crabwalk'
  success: boolean
  error?: string
}

interface AutoStartConfig {
  launchAgentEnabled: boolean
  autoStartOpenClaw: boolean
  autoStartCrabwalk: boolean
  autoOpenOpenClawPanel: boolean
  autoOpenCrabwalkPanel: boolean
  openclawGatewayToken: string
  openclawModelProvider: 'minimax' | 'local'
  openclawMinimaxApiKey: string
  openclawMinimaxModel: string
  openclawLocalBaseUrl: string
  openclawLocalModelName: string
  openclawLocalApiKey: string
  startMinimized: boolean
  version: string
}

interface ProjectDefaults {
  gatewayToken: string
  minimaxApiKey: string
  minimaxModel: string
  localBaseUrl: string
  localModelName: string
  localApiKey: string
  modelProvider: 'minimax' | 'local' | ''
  sources: Record<string, string>
}

interface EffectiveValue {
  value: string
  source: 'user' | 'project' | 'none'
}

declare global {
  interface Window {
    api: {
      startOpenClaw: () => Promise<ActionResult>
      startCrabwalk: () => Promise<ActionResult>
      stopProcess: (name: string) => Promise<ActionResult>
      getProcessStatus: () => Promise<ProcessStatus>
      checkLaunchAgent: () => Promise<LaunchAgentStatus>
      enableLaunchAgent: () => Promise<ActionResult>
      disableLaunchAgent: () => Promise<ActionResult>
      getPaths: () => Promise<Record<string, string>>
      getOpenClawPanelUrl: () => Promise<{
        success: boolean
        url: string
        port: number | null
        host: string
        source: string
        message?: string
        error?: string
      }>
      getCrabwalkPanelUrl: () => Promise<{
        success: boolean
        url: string
        port: number | null
        host: string
        source: string
        message?: string
        error?: string
      }>
      waitAndOpenOpenClaw: () => Promise<{
        success: boolean
        url?: string
        port?: number
        host?: string
        source?: string
        error?: string
      }>
      waitAndOpenCrabwalk: () => Promise<{
        success: boolean
        url?: string
        port?: number
        host?: string
        source?: string
        error?: string
      }>
      openInSafari: (url: string) => Promise<{ success: boolean; error?: string }>
      getAutoStartConfig: () => Promise<{
        success: boolean
        config: AutoStartConfig
        configPath: string
        error?: string
      }>
      saveAutoStartConfig: (config: Partial<AutoStartConfig>) => Promise<{
        success: boolean
        config: AutoStartConfig
        error?: string
      }>
      getProjectDefaults: () => Promise<{
        success: boolean
        defaults: ProjectDefaults
        error?: string
      }>
      getEffectiveConfig: () => Promise<{
        success: boolean
        effective: Record<string, EffectiveValue>
        userConfig: AutoStartConfig
        projectDefaults: ProjectDefaults
        error?: string
      }>
      onServiceStarted: (callback: (_event: unknown, data: ServiceStartedData) => void) => () => void
    }
  }
}

interface ProcessStatus {
  openclaw: boolean
  crabwalk: boolean
}

type Tab = 'launcher' | 'settings' | 'logs' | 'autostart'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('launcher')
  const [processStatus, setProcessStatus] = useState<ProcessStatus>({
    openclaw: false,
    crabwalk: false,
  })
  const [launchAgentEnabled, setLaunchAgentEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [detectedPanels, setDetectedPanels] = useState<{
    openclaw?: { ip?: string; port?: number; source?: string; message?: string }
    crabwalk?: { ip?: string; port?: number; source?: string; message?: string }
  }>({})

  // 自动启动配置 - 从工具函数获取默认值
  const [autoStartConfig, setAutoStartConfig] = useState<AutoStartConfig>(() => {
    const defaults: AutoStartConfig = {
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

    // 尝试从 localStorage 立即读取（同步）
    try {
      const stored = localStorage.getItem('clawdbot-launcher-config')
      if (stored) {
        return { ...defaults, ...JSON.parse(stored) }
      }
    } catch (e) {
      console.error('读取 localStorage 失败:', e)
    }
    return defaults
  })
  const [configPath, setConfigPath] = useState('')
  const [autoStartLogs, setAutoStartLogs] = useState<string[]>([])
  const [projectDefaults, setProjectDefaults] = useState<ProjectDefaults>({
    gatewayToken: '',
    minimaxApiKey: '',
    minimaxModel: '',
    localBaseUrl: '',
    localModelName: '',
    localApiKey: '',
    modelProvider: '',
    sources: {},
  })

  // 定期检查进程状态
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const status = await window.api?.getProcessStatus?.()
        if (status) {
          setProcessStatus(status)
        }
      } catch (error) {
        console.error('检查进程状态失败:', error)
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [])

  // 初始化：检查 LaunchAgent 状态和自动启动配置
  useEffect(() => {
    const init = async () => {
      try {
        // 检查 LaunchAgent
        const result = await window.api?.checkLaunchAgent?.()
        if (result) {
          setLaunchAgentEnabled(result.enabled)
        }
        
        // 加载自动启动配置通过 IPC
        const configResult = await window.api?.getAutoStartConfig?.()
        if (configResult) {
          setAutoStartConfig(configResult.config)
          setConfigPath(configResult.configPath)
        }
        
        // 加载项目默认配置
        const defaultsResult = await window.api?.getProjectDefaults?.()
        if (defaultsResult?.success) {
          setProjectDefaults(defaultsResult.defaults)
        }
        
        // 检查是否为演示模式
        const isDemo = !result || result.message?.includes('演示模式')
        if (isDemo) {
          addLog('⚠️  浏览器模式：配置将保存在 localStorage')
          addLog('📝  开机启动功能需要 Electron 应用')
        } else {
          addLog('✓ 应用已启动')
        }
      } catch (error) {
        console.error('初始化错误:', error)
        addLog('⚠️  初始化失败，使用默认配置')
      }
    }
    init()
  }, [])

  // 监听自动启动事件
  useEffect(() => {
    if (!window.api?.onServiceStarted) {
      return
    }
    
    const unsubscribe = window.api.onServiceStarted((_event, data) => {
      const timestamp = new Date().toLocaleTimeString()
      if (data.success) {
        setAutoStartLogs(prev => [...prev, `[${timestamp}] ✓ ${data.name} 自动启动成功`])
      } else {
        setAutoStartLogs(prev => [...prev, `[${timestamp}] ✗ ${data.name} 自动启动失败: ${data.error}`])
      }
    })
    
    return () => unsubscribe()
  }, [])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`].slice(-50))
  }

  // 保存自动启动配置 - 支持浏览器和 Electron
  const handleSaveAutoStartConfig = async (updates: Partial<AutoStartConfig>) => {
    setLoading(true)
    try {
      // 合并当前配置和更新
      const newConfig = { ...autoStartConfig, ...updates }
      
      // 保存到 localStorage（浏览器环境）
      try {
        localStorage.setItem('clawdbot-launcher-config', JSON.stringify(newConfig))
      } catch (e) {
        console.error('保存到 localStorage 失败:', e)
      }
      
      // 如果在 Electron 环境，同时保存到文件
      if (window.api?.saveAutoStartConfig) {
        const result = await window.api.saveAutoStartConfig(updates)
        if (result?.success) {
          addLog('✓ 配置已保存到文件')
        } else {
          console.warn('保存到文件失败:', result?.error)
        }
      } else {
        addLog('✓ 配置已保存到浏览器')
      }
      
      setAutoStartConfig(newConfig)
    } catch (error) {
      console.error('保存配置错误:', error)
      addLog(`✗ 保存配置失败: ${error}`)
      alert(`保存配置失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // 切换 LaunchAgent 并同步配置
  const handleToggleLaunchAgent = async () => {
    setLoading(true)
    try {
      let result
      if (launchAgentEnabled) {
        result = await window.api?.disableLaunchAgent?.()
        await handleSaveAutoStartConfig({ launchAgentEnabled: false })
        addLog('✓ 禁用开机启动')
      } else {
        result = await window.api?.enableLaunchAgent?.()
        await handleSaveAutoStartConfig({ launchAgentEnabled: true })
        addLog('✓ 启用开机启动')
      }

      if (result?.success) {
        setLaunchAgentEnabled(!launchAgentEnabled)
        setMessage(result.message || '操作成功')
      } else {
        setMessage(`失败: ${result?.error || '未知错误'}`)
      }
    } catch (error) {
      setMessage(`错误: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // 打开 OpenClaw 面板
  const handleOpenOpenClawPanel = async () => {
    try {
      const result = await window.api?.getOpenClawPanelUrl?.()
      if (result) {
        setDetectedPanels({
          ...detectedPanels,
          openclaw: {
            ip: result.host,
            port: result.port ?? undefined,
            source: result.source,
            message: result.message,
          },
        })
        
        if (result.url) {
          if (window.api?.openInSafari) {
            await window.api.openInSafari(result.url)
          } else {
            window.open(result.url, '_blank')
          }
          addLog(`📱 打开 OpenClaw 面板: ${result.url}`)
        }
      } else {
        throw new Error('无法获取 OpenClaw 面板地址')
      }
    } catch (error) {
      addLog(`⚠️  无法打开 OpenClaw 面板: ${error}`)
      alert(`打开 OpenClaw 面板失败: ${error}`)
    }
  }

  // 打开 Crabwalk 面板
  const handleOpenCrabwalkPanel = async () => {
    try {
      const result = await window.api?.getCrabwalkPanelUrl?.()
      if (result) {
        setDetectedPanels({
          ...detectedPanels,
          crabwalk: {
            ip: result.host,
            port: result.port ?? undefined,
            source: result.source,
            message: result.message,
          },
        })
        
        if (result.url) {
          if (window.api?.openInSafari) {
            await window.api.openInSafari(result.url)
          } else {
            window.open(result.url, '_blank')
          }
          addLog(`📱 打开 Crabwalk 面板: ${result.url}`)
        }
      } else {
        throw new Error('无法获取 Crabwalk 面板地址')
      }
    } catch (error) {
      addLog(`⚠️  无法打开 Crabwalk 面板: ${error}`)
      alert(`打开 Crabwalk 面板失败: ${error}`)
    }
  }

  const handleStartOpenClaw = async () => {
    if (processStatus.openclaw) {
      setMessage('OpenClaw 已在运行')
      return
    }

    setLoading(true)
    addLog('🚀 正在启动 OpenClaw...')
    
    try {
      const result = await window.api?.startOpenClaw?.()
      if (result?.success) {
        addLog('✓ OpenClaw 进程已启动')
        setMessage(result.message || 'OpenClaw 已启动')
        
        setTimeout(() => {
          window.api?.getProcessStatus?.().then(setProcessStatus).catch(() => {})
        }, 1000)
        
        addLog('🔍 正在检测 OpenClaw 面板地址...')
        const panelResult = await window.api?.waitAndOpenOpenClaw?.()
        
        if (panelResult?.success) {
          setDetectedPanels(prev => ({
            ...prev,
            openclaw: {
              ip: panelResult.host,
              port: panelResult.port,
              source: panelResult.source,
            },
          }))
          addLog(`✓ 已打开 OpenClaw 面板: ${panelResult.url}`)
        } else {
          addLog(`⚠️ 无法自动打开面板: ${panelResult?.error || '检测超时'}`)
        }
      } else {
        addLog(`✗ OpenClaw 启动失败: ${result?.error || '未知错误'}`)
        setMessage(`启动失败: ${result?.error || '未知错误'}`)
      }
    } catch (error) {
      addLog(`✗ 错误: ${error}`)
      setMessage(`错误: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStartCrabwalk = async () => {
    if (processStatus.crabwalk) {
      setMessage('Crabwalk 已在运行')
      return
    }

    setLoading(true)
    addLog('🚀 正在启动 Crabwalk...')
    
    try {
      const result = await window.api?.startCrabwalk?.()
      if (result?.success) {
        addLog('✓ Crabwalk 进程已启动')
        setMessage(result.message || 'Crabwalk 已启动')
        
        setTimeout(() => {
          window.api?.getProcessStatus?.().then(setProcessStatus).catch(() => {})
        }, 2000)
        
        addLog('🔍 正在检测 Crabwalk 面板地址...')
        const panelResult = await window.api?.waitAndOpenCrabwalk?.()
        
        if (panelResult?.success) {
          setDetectedPanels(prev => ({
            ...prev,
            crabwalk: {
              ip: panelResult.host,
              port: panelResult.port,
              source: panelResult.source,
            },
          }))
          addLog(`✓ 已打开 Crabwalk 面板: ${panelResult.url}`)
        } else {
          addLog(`⚠️ 无法自动打开面板: ${panelResult?.error || '检测超时'}`)
        }
      } else {
        addLog(`✗ Crabwalk 启动失败: ${result?.error || '未知错误'}`)
        setMessage(`启动失败: ${result?.error || '未知错误'}`)
      }
    } catch (error) {
      addLog(`✗ 错误: ${error}`)
      setMessage(`错误: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStopOpenClaw = async () => {
    setLoading(true)
    try {
      const result = await window.api?.stopProcess?.('openclaw')
      if (result?.success) {
        addLog('✓ OpenClaw 已停止')
        setMessage(result.message || 'OpenClaw 已停止')
        setTimeout(() => {
          setProcessStatus((prev) => ({ ...prev, openclaw: false }))
        }, 500)
      } else {
        setMessage(`停止失败: ${result?.error || '未知错误'}`)
      }
    } catch (error) {
      setMessage(`错误: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStopCrabwalk = async () => {
    setLoading(true)
    try {
      const result = await window.api?.stopProcess?.('crabwalk')
      if (result?.success) {
        addLog('✓ Crabwalk 已停止')
        setMessage(result.message || 'Crabwalk 已停止')
        setTimeout(() => {
          setProcessStatus((prev) => ({ ...prev, crabwalk: false }))
        }, 500)
      } else {
        setMessage(`停止失败: ${result?.error || '未知错误'}`)
      }
    } catch (error) {
      setMessage(`错误: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRestartOpenClaw = async () => {
    setLoading(true)
    addLog('🔄 正在重启 OpenClaw...')
    try {
      if (processStatus.openclaw) {
        await window.api?.stopProcess?.('openclaw')
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }

      const result = await window.api?.startOpenClaw?.()
      if (result?.success) {
        addLog('✓ OpenClaw 已重启')
        setMessage(result.message || 'OpenClaw 已重启')
        setTimeout(() => {
          window.api?.getProcessStatus?.().then(setProcessStatus).catch(() => {})
        }, 1000)
      } else {
        setMessage(`重启失败: ${result?.error || '未知错误'}`)
        addLog(`✗ OpenClaw 重启失败: ${result?.error || '未知错误'}`)
      }
    } catch (error) {
      setMessage(`错误: ${error}`)
      addLog(`✗ OpenClaw 重启异常: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRestartCrabwalk = async () => {
    setLoading(true)
    addLog('🔄 正在重启 Crabwalk...')
    try {
      if (processStatus.crabwalk) {
        await window.api?.stopProcess?.('crabwalk')
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }

      const result = await window.api?.startCrabwalk?.()
      if (result?.success) {
        addLog('✓ Crabwalk 已重启')
        setMessage(result.message || 'Crabwalk 已重启')
        setTimeout(() => {
          window.api?.getProcessStatus?.().then(setProcessStatus).catch(() => {})
        }, 1200)
      } else {
        setMessage(`重启失败: ${result?.error || '未知错误'}`)
        addLog(`✗ Crabwalk 重启失败: ${result?.error || '未知错误'}`)
      }
    } catch (error) {
      setMessage(`错误: ${error}`)
      addLog(`✗ Crabwalk 重启异常: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // 辅助函数：获取某字段的有效值来源
  const getFieldSource = (userValue: string, defaultValue: string): 'user' | 'project' | 'none' => {
    if (typeof userValue === 'string' && userValue.trim()) { return 'user' }
    if (typeof defaultValue === 'string' && defaultValue.trim()) { return 'project' }
    return 'none'
  }

  // 辅助函数：遮掩显示 API Key
  const maskValue = (val: string): string => {
    if (!val || val.length <= 8) { return val ? '******' : '' }
    return val.slice(0, 4) + '····' + val.slice(-4)
  }

  // 来源标签组件
  const SourceBadge = ({ source, defaultSource }: { source: 'user' | 'project' | 'none'; defaultSource?: string }) => {
    if (source === 'user') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e6f7e6', color: '#2d8a2d', fontWeight: 500, marginLeft: '8px' }}>✏️ 手动配置</span>
    }
    if (source === 'project') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e8f0fe', color: '#1a56db', fontWeight: 500, marginLeft: '8px' }}>📁 项目默认{defaultSource ? ` (${defaultSource})` : ''}</span>
    }
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#fff3e0', color: '#e65100', fontWeight: 500, marginLeft: '8px' }}>⚠️ 未配置</span>
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>
            <Rocket className="logo-icon" />
            ClawBot Launcher
          </h1>
        </div>
      </header>

      <nav className="nav-tabs">
        <button
          className={`tab-button ${activeTab === 'launcher' ? 'active' : ''}`}
          onClick={() => setActiveTab('launcher')}
        >
          启动器
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} /> 设置
        </button>
        <button
          className={`tab-button ${activeTab === 'autostart' ? 'active' : ''}`}
          onClick={() => setActiveTab('autostart')}
        >
          <Clock size={18} /> 自动启动
        </button>
        <button
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          日志
        </button>
      </nav>

      <main className="main-content">
        {/* 启动器标签页 */}
        {activeTab === 'launcher' && (
          <div className="tab-content">
            <div className="launcher-grid">
              {/* OpenClaw 卡片 */}
              <div className="service-card">
                <div className="card-header">
                  <h2>OpenClaw</h2>
                  <div
                    className={`status-indicator ${processStatus.openclaw ? 'active' : ''}`}
                  >
                    <div className="status-dot"></div>
                    {processStatus.openclaw ? '运行中' : '已停止'}
                  </div>
                </div>
                <p className="card-description">AI Agent 框架</p>
                
                {detectedPanels.openclaw && (
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: '#666', 
                    marginBottom: '10px',
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}>
                    <div>📍 地址: {detectedPanels.openclaw.ip}:{detectedPanels.openclaw.port}</div>
                    <div>🔍 来源: {detectedPanels.openclaw.source}</div>
                    {detectedPanels.openclaw.message && <div>💬 {detectedPanels.openclaw.message}</div>}
                  </div>
                )}
                
                <div className="card-buttons">
                  <button
                    className="btn btn-primary"
                    onClick={handleStartOpenClaw}
                    disabled={loading || processStatus.openclaw}
                  >
                    <Play size={16} />
                    启动
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleStopOpenClaw}
                    disabled={loading || !processStatus.openclaw}
                  >
                    <Square size={16} />
                    停止
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleRestartOpenClaw}
                    disabled={loading}
                  >
                    <RotateCcw size={16} />
                    重启
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleOpenOpenClawPanel}
                    disabled={loading}
                  >
                    <ExternalLink size={16} />
                    打开面板
                  </button>
                </div>
              </div>

              {/* Crabwalk 卡片 */}
              <div className="service-card">
                <div className="card-header">
                  <h2>Crabwalk</h2>
                  <div
                    className={`status-indicator ${processStatus.crabwalk ? 'active' : ''}`}
                  >
                    <div className="status-dot"></div>
                    {processStatus.crabwalk ? '运行中' : '已停止'}
                  </div>
                </div>
                <p className="card-description">可视化监控面板</p>
                
                {detectedPanels.crabwalk && (
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: '#666', 
                    marginBottom: '10px',
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}>
                    <div>📍 地址: {detectedPanels.crabwalk.ip}:{detectedPanels.crabwalk.port}</div>
                    <div>🔍 来源: {detectedPanels.crabwalk.source}</div>
                    {detectedPanels.crabwalk.message && <div>💬 {detectedPanels.crabwalk.message}</div>}
                  </div>
                )}
                
                <div className="card-buttons">
                  <button
                    className="btn btn-primary"
                    onClick={handleStartCrabwalk}
                    disabled={loading || processStatus.crabwalk}
                  >
                    <Play size={16} />
                    启动
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleStopCrabwalk}
                    disabled={loading || !processStatus.crabwalk}
                  >
                    <Square size={16} />
                    停止
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleRestartCrabwalk}
                    disabled={loading}
                  >
                    <RotateCcw size={16} />
                    重启
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleOpenCrabwalkPanel}
                    disabled={loading}
                  >
                    <ExternalLink size={16} />
                    打开面板
                  </button>
                </div>
              </div>
            </div>

            {message && <div className="message-box">{message}</div>}
          </div>
        )}

        {/* 设置标签页 */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            <div className="settings-container">
              <div className="setting-group">
                <div className="setting-header">
                  <h3>开机启动设置</h3>
                  <p className="setting-description">
                    启用后，系统启动时将自动运行 ClawBot Launcher
                  </p>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <h4>开机自动启动 Launcher</h4>
                    <p>在系统启动时自动运行 Launcher</p>
                  </div>
                  <button
                    className={`toggle-btn ${launchAgentEnabled ? 'enabled' : ''}`}
                    onClick={handleToggleLaunchAgent}
                    disabled={loading || !window.api?.enableLaunchAgent}
                    title={!window.api?.enableLaunchAgent ? '开机启动需要 Electron 应用' : (launchAgentEnabled ? '点击禁用' : '点击启用')}
                  >
                    <Power size={18} />
                    {launchAgentEnabled ? '已启用' : '已禁用'}
                  </button>
                </div>

                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ChevronRight size={18} />
                    需要更多自动启动选项？
                  </h4>
                  <p style={{ color: '#666', fontSize: '0.9rem' }}>
                    前往「自动启动」标签页，可以配置开机后自动启动 OpenClaw、Crabwalk 并自动打开 WebUI。
                  </p>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('autostart')}
                    style={{ marginTop: '10px' }}
                  >
                    前往自动启动设置
                  </button>
                </div>
              </div>

              <div className="setting-group">
                <h3>关于</h3>
                <div className="about-info">
                  <p>
                    <strong>应用名称:</strong> ClawBot Launcher
                  </p>
                  <p>
                    <strong>版本:</strong> 1.0.0
                  </p>
                  <p>
                    <strong>描述:</strong> 用于启动和管理 OpenClaw 和 Crabwalk 的启动器
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 自动启动标签页 */}
        {activeTab === 'autostart' && (
          <div className="tab-content">
            <div className="settings-container">
              <div className="setting-group">
                <div className="setting-header">
                  <h3><Clock size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />自动启动配置</h3>
                  <p className="setting-description">
                    配置开机后自动启动的服务和行为。配置保存在 <code>{configPath || '~/.clawdbot-launcher/autostart.json'}</code>
                  </p>
                </div>

                {/* 开机启动 Launcher */}
                <div className="setting-item" style={{ borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                  <div className="setting-info">
                    <h4><Monitor size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />开机自动启动 Launcher</h4>
                    <p>系统启动时自动运行 ClawBot Launcher</p>
                  </div>
                  <button
                    className={`toggle-btn ${autoStartConfig.launchAgentEnabled ? 'enabled' : ''}`}
                    onClick={() => {
                      handleToggleLaunchAgent()
                      setAutoStartConfig(prev => ({ ...prev, launchAgentEnabled: !prev.launchAgentEnabled }))
                    }}
                    disabled={loading || !window.api?.enableLaunchAgent}
                    title={!window.api?.enableLaunchAgent ? '开机启动需要 Electron 应用' : (autoStartConfig.launchAgentEnabled ? '点击禁用' : '点击启用')}
                  >
                    <Power size={18} />
                    {autoStartConfig.launchAgentEnabled ? '已启用' : '已禁用'}
                  </button>
                </div>

                {/* 自动启动 OpenClaw */}
                <div className="setting-item" style={{ borderBottom: '1px solid #eee', padding: '15px 0' }}>
                  <div className="setting-info">
                    <h4>🦞 启动后自动启动 OpenClaw</h4>
                    <p>Launcher 启动后自动启动 OpenClaw 服务</p>
                  </div>
                  <button
                    className={`toggle-btn ${autoStartConfig.autoStartOpenClaw ? 'enabled' : ''}`}
                    onClick={() => handleSaveAutoStartConfig({ autoStartOpenClaw: !autoStartConfig.autoStartOpenClaw })}
                    disabled={loading}
                    title={autoStartConfig.autoStartOpenClaw ? '点击禁用' : '点击启用'}
                  >
                    {autoStartConfig.autoStartOpenClaw ? '已启用' : '已禁用'}
                  </button>
                </div>

                {/* 自动打开 OpenClaw 面板 */}
                <div className="setting-item" style={{ paddingLeft: '30px', borderBottom: '1px solid #eee', padding: '10px 0 15px 30px' }}>
                  <div className="setting-info">
                    <h4 style={{ fontSize: '0.95rem', color: '#555' }}>📱 自动打开 OpenClaw WebUI</h4>
                    <p style={{ fontSize: '0.85rem' }}>OpenClaw 启动后自动在浏览器中打开面板</p>
                  </div>
                  <button
                    className={`toggle-btn ${autoStartConfig.autoOpenOpenClawPanel ? 'enabled' : ''}`}
                    style={{ transform: 'scale(0.9)' }}
                    onClick={() => handleSaveAutoStartConfig({ autoOpenOpenClawPanel: !autoStartConfig.autoOpenOpenClawPanel })}
                    disabled={loading || !autoStartConfig.autoStartOpenClaw}
                    title={!autoStartConfig.autoStartOpenClaw ? '需先启用自动启动 OpenClaw' : (autoStartConfig.autoOpenOpenClawPanel ? '点击禁用' : '点击启用')}
                  >
                    {autoStartConfig.autoOpenOpenClawPanel ? '已启用' : '已禁用'}
                  </button>
                </div>

                {/* OpenClaw Gateway Token */}
                <div className="setting-item" style={{ paddingLeft: '30px', borderBottom: '1px solid #eee', padding: '12px 0 15px 30px', alignItems: 'flex-start' }}>
                  <div className="setting-info" style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.95rem', color: '#555', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                      🔑 OpenClaw Gateway Token
                      <SourceBadge 
                        source={getFieldSource(autoStartConfig.openclawGatewayToken, projectDefaults.gatewayToken)} 
                        defaultSource={projectDefaults.sources.gatewayToken}
                      />
                    </h4>
                    <p style={{ fontSize: '0.85rem' }}>用于修复 disconnected (1008): unauthorized。请从 Dashboard URL 复制 token 后粘贴。</p>
                    {!autoStartConfig.openclawGatewayToken && projectDefaults.gatewayToken && (
                      <p style={{ fontSize: '0.8rem', color: '#1a56db', marginTop: '4px' }}>
                        📁 使用项目默认值: {maskValue(projectDefaults.gatewayToken)}
                      </p>
                    )}
                    <div style={{ position: 'relative', marginTop: '8px' }}>
                      <input
                        type="password"
                        placeholder={projectDefaults.gatewayToken ? `留空使用项目默认 (${maskValue(projectDefaults.gatewayToken)})` : '粘贴 gateway token'}
                        value={autoStartConfig.openclawGatewayToken || ''}
                        onChange={(e) => setAutoStartConfig(prev => ({ ...prev, openclawGatewayToken: e.target.value }))}
                        onBlur={(e) => handleSaveAutoStartConfig({ openclawGatewayToken: e.target.value || '' })}
                        disabled={loading}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          paddingRight: autoStartConfig.openclawGatewayToken ? '60px' : '10px',
                          borderRadius: '6px',
                          border: '1px solid #d9d9d9',
                          fontSize: '0.9rem',
                        }}
                      />
                      {autoStartConfig.openclawGatewayToken && (
                        <button
                          onClick={() => {
                            setAutoStartConfig(prev => ({ ...prev, openclawGatewayToken: '' }))
                            handleSaveAutoStartConfig({ openclawGatewayToken: '' })
                          }}
                          style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #d9d9d9', backgroundColor: '#f5f5f5', cursor: 'pointer', color: '#666' }}
                          title="清空，使用项目默认值"
                        >
                          重置
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* OpenClaw 默认模型 */}
                <div className="setting-item" style={{ paddingLeft: '30px', borderBottom: '1px solid #eee', padding: '12px 0 15px 30px', alignItems: 'flex-start' }}>
                  <div className="setting-info" style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.95rem', color: '#555' }}>🧠 OpenClaw 默认模型</h4>
                    <p style={{ fontSize: '0.85rem' }}>选择启动 OpenClaw 时使用的模型类型：MiniMax 或本地模型。</p>
                    <select
                      value={autoStartConfig.openclawModelProvider}
                      onChange={(e) => {
                        const provider = e.target.value as 'minimax' | 'local'
                        setAutoStartConfig((prev) => ({ ...prev, openclawModelProvider: provider }))
                        handleSaveAutoStartConfig({ openclawModelProvider: provider })
                      }}
                      disabled={loading}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #d9d9d9',
                        fontSize: '0.9rem',
                        backgroundColor: '#fff',
                      }}
                    >
                      <option value="minimax">MiniMax</option>
                      <option value="local">本地模型</option>
                    </select>

                    {autoStartConfig.openclawModelProvider === 'minimax' && (
                      <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>MiniMax API Key</span>
                            <SourceBadge 
                              source={getFieldSource(autoStartConfig.openclawMinimaxApiKey, projectDefaults.minimaxApiKey)} 
                              defaultSource={projectDefaults.sources.minimaxApiKey}
                            />
                          </div>
                          {!autoStartConfig.openclawMinimaxApiKey && projectDefaults.minimaxApiKey && (
                            <p style={{ fontSize: '0.8rem', color: '#1a56db', margin: '0 0 4px 0' }}>
                              📁 使用项目默认值: {maskValue(projectDefaults.minimaxApiKey)}
                            </p>
                          )}
                          <div style={{ position: 'relative' }}>
                            <input
                              type="password"
                              placeholder={projectDefaults.minimaxApiKey ? `留空使用项目默认 (${maskValue(projectDefaults.minimaxApiKey)})` : 'MiniMax API Key'}
                              value={autoStartConfig.openclawMinimaxApiKey || ''}
                              onChange={(e) => setAutoStartConfig(prev => ({ ...prev, openclawMinimaxApiKey: e.target.value }))}
                              onBlur={(e) => handleSaveAutoStartConfig({ openclawMinimaxApiKey: e.target.value || '' })}
                              disabled={loading}
                              style={{ width: '100%', padding: '8px 10px', paddingRight: autoStartConfig.openclawMinimaxApiKey ? '60px' : '10px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '0.9rem' }}
                            />
                            {autoStartConfig.openclawMinimaxApiKey && (
                              <button
                                onClick={() => {
                                  setAutoStartConfig(prev => ({ ...prev, openclawMinimaxApiKey: '' }))
                                  handleSaveAutoStartConfig({ openclawMinimaxApiKey: '' })
                                }}
                                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #d9d9d9', backgroundColor: '#f5f5f5', cursor: 'pointer', color: '#666' }}
                                title="清空，使用项目默认值"
                              >
                                重置
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>MiniMax 模型名</span>
                            <SourceBadge 
                              source={getFieldSource(autoStartConfig.openclawMinimaxModel, projectDefaults.minimaxModel)} 
                              defaultSource={projectDefaults.sources.minimaxModel}
                            />
                          </div>
                          <input
                            type="text"
                            placeholder={projectDefaults.minimaxModel ? `留空使用项目默认 (${projectDefaults.minimaxModel})` : 'MiniMax 模型名（默认 MiniMax-M1）'}
                            value={autoStartConfig.openclawMinimaxModel || ''}
                            onChange={(e) => setAutoStartConfig(prev => ({ ...prev, openclawMinimaxModel: e.target.value }))}
                            onBlur={(e) => handleSaveAutoStartConfig({ openclawMinimaxModel: e.target.value || 'MiniMax-M1' })}
                            disabled={loading}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '0.9rem' }}
                          />
                        </div>
                      </div>
                    )}

                    {autoStartConfig.openclawModelProvider === 'local' && (
                      <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>本地模型服务地址</span>
                            <SourceBadge 
                              source={getFieldSource(autoStartConfig.openclawLocalBaseUrl, projectDefaults.localBaseUrl)} 
                              defaultSource={projectDefaults.sources.localBaseUrl}
                            />
                          </div>
                          {!autoStartConfig.openclawLocalBaseUrl && projectDefaults.localBaseUrl && (
                            <p style={{ fontSize: '0.8rem', color: '#1a56db', margin: '0 0 4px 0' }}>
                              📁 使用项目默认值: {projectDefaults.localBaseUrl}
                            </p>
                          )}
                          <input
                            type="text"
                            placeholder={projectDefaults.localBaseUrl ? `留空使用项目默认 (${projectDefaults.localBaseUrl})` : '本地模型服务地址（如 http://127.0.0.1:11434/v1）'}
                            value={autoStartConfig.openclawLocalBaseUrl || ''}
                            onChange={(e) => setAutoStartConfig(prev => ({ ...prev, openclawLocalBaseUrl: e.target.value }))}
                            onBlur={(e) => handleSaveAutoStartConfig({ openclawLocalBaseUrl: e.target.value || 'http://127.0.0.1:11434/v1' })}
                            disabled={loading}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '0.9rem' }}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>本地模型名</span>
                            <SourceBadge 
                              source={getFieldSource(autoStartConfig.openclawLocalModelName, projectDefaults.localModelName)} 
                              defaultSource={projectDefaults.sources.localModelName}
                            />
                          </div>
                          {!autoStartConfig.openclawLocalModelName && projectDefaults.localModelName && (
                            <p style={{ fontSize: '0.8rem', color: '#1a56db', margin: '0 0 4px 0' }}>
                              📁 使用项目默认值: {projectDefaults.localModelName}
                            </p>
                          )}
                          <input
                            type="text"
                            placeholder={projectDefaults.localModelName ? `留空使用项目默认 (${projectDefaults.localModelName})` : '本地模型名（如 qwen2.5:7b）'}
                            value={autoStartConfig.openclawLocalModelName || ''}
                            onChange={(e) => setAutoStartConfig(prev => ({ ...prev, openclawLocalModelName: e.target.value }))}
                            onBlur={(e) => handleSaveAutoStartConfig({ openclawLocalModelName: e.target.value || '' })}
                            disabled={loading}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '0.9rem' }}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>本地模型 API Key（可选）</span>
                            <SourceBadge 
                              source={getFieldSource(autoStartConfig.openclawLocalApiKey, projectDefaults.localApiKey)} 
                              defaultSource={projectDefaults.sources.localApiKey}
                            />
                          </div>
                          {!autoStartConfig.openclawLocalApiKey && projectDefaults.localApiKey && (
                            <p style={{ fontSize: '0.8rem', color: '#1a56db', margin: '0 0 4px 0' }}>
                              📁 使用项目默认值: {maskValue(projectDefaults.localApiKey)}
                            </p>
                          )}
                          <div style={{ position: 'relative' }}>
                            <input
                              type="password"
                              placeholder={projectDefaults.localApiKey ? `留空使用项目默认 (${maskValue(projectDefaults.localApiKey)})` : '本地模型 API Key（可选）'}
                              value={autoStartConfig.openclawLocalApiKey || ''}
                              onChange={(e) => setAutoStartConfig(prev => ({ ...prev, openclawLocalApiKey: e.target.value }))}
                              onBlur={(e) => handleSaveAutoStartConfig({ openclawLocalApiKey: e.target.value || '' })}
                              disabled={loading}
                              style={{ width: '100%', padding: '8px 10px', paddingRight: autoStartConfig.openclawLocalApiKey ? '60px' : '10px', borderRadius: '6px', border: '1px solid #d9d9d9', fontSize: '0.9rem' }}
                            />
                            {autoStartConfig.openclawLocalApiKey && (
                              <button
                                onClick={() => {
                                  setAutoStartConfig(prev => ({ ...prev, openclawLocalApiKey: '' }))
                                  handleSaveAutoStartConfig({ openclawLocalApiKey: '' })
                                }}
                                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #d9d9d9', backgroundColor: '#f5f5f5', cursor: 'pointer', color: '#666' }}
                                title="清空，使用项目默认值"
                              >
                                重置
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 自动启动 Crabwalk */}
                <div className="setting-item" style={{ borderBottom: '1px solid #eee', padding: '15px 0' }}>
                  <div className="setting-info">
                    <h4>🦀 启动后自动启动 Crabwalk</h4>
                    <p>Launcher 启动后自动启动 Crabwalk 服务</p>
                  </div>
                  <button
                    className={`toggle-btn ${autoStartConfig.autoStartCrabwalk ? 'enabled' : ''}`}
                    onClick={() => handleSaveAutoStartConfig({ autoStartCrabwalk: !autoStartConfig.autoStartCrabwalk })}
                    disabled={loading}
                    title={autoStartConfig.autoStartCrabwalk ? '点击禁用' : '点击启用'}
                  >
                    {autoStartConfig.autoStartCrabwalk ? '已启用' : '已禁用'}
                  </button>
                </div>

                {/* 自动打开 Crabwalk 面板 */}
                <div className="setting-item" style={{ paddingLeft: '30px', borderBottom: '1px solid #eee', padding: '10px 0 15px 30px' }}>
                  <div className="setting-info">
                    <h4 style={{ fontSize: '0.95rem', color: '#555' }}>📱 自动打开 Crabwalk WebUI</h4>
                    <p style={{ fontSize: '0.85rem' }}>Crabwalk 启动后自动在浏览器中打开面板</p>
                  </div>
                  <button
                    className={`toggle-btn ${autoStartConfig.autoOpenCrabwalkPanel ? 'enabled' : ''}`}
                    style={{ transform: 'scale(0.9)' }}
                    onClick={() => handleSaveAutoStartConfig({ autoOpenCrabwalkPanel: !autoStartConfig.autoOpenCrabwalkPanel })}
                    disabled={loading || !autoStartConfig.autoStartCrabwalk}
                    title={!autoStartConfig.autoStartCrabwalk ? '需先启用自动启动 Crabwalk' : (autoStartConfig.autoOpenCrabwalkPanel ? '点击禁用' : '点击启用')}
                  >
                    {autoStartConfig.autoOpenCrabwalkPanel ? '已启用' : '已禁用'}
                  </button>
                </div>

                {/* 当前配置状态 */}
                <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '8px', border: '1px solid #cce0ff' }}>
                  <h4 style={{ marginBottom: '10px', color: '#0066cc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Database size={16} />
                    当前有效配置
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px' }}>
                    💡 规则：如果 UI 中填写了值则使用手动配置，否则自动使用项目默认配置（来自 openclaw.json / .env）
                  </p>
                  <div style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.8' }}>
                    <div>• 开机启动 Launcher: {autoStartConfig.launchAgentEnabled ? '✅' : '❌'}</div>
                    <div>• 自动启动 OpenClaw: {autoStartConfig.autoStartOpenClaw ? '✅' : '❌'} {autoStartConfig.autoStartOpenClaw && autoStartConfig.autoOpenOpenClawPanel && '(自动打开面板)'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                      • Gateway Token: {(autoStartConfig.openclawGatewayToken || projectDefaults.gatewayToken) ? '✅ 已配置' : '❌ 未配置'}
                      <SourceBadge 
                        source={getFieldSource(autoStartConfig.openclawGatewayToken, projectDefaults.gatewayToken)} 
                        defaultSource={projectDefaults.sources.gatewayToken}
                      />
                    </div>
                    <div>• 模型类型: {autoStartConfig.openclawModelProvider === 'local' ? '本地模型' : 'MiniMax'}</div>
                    {autoStartConfig.openclawModelProvider === 'minimax' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          • MiniMax API Key: {(autoStartConfig.openclawMinimaxApiKey || projectDefaults.minimaxApiKey) ? '✅ 已配置' : '❌ 未配置'}
                          <SourceBadge 
                            source={getFieldSource(autoStartConfig.openclawMinimaxApiKey, projectDefaults.minimaxApiKey)} 
                            defaultSource={projectDefaults.sources.minimaxApiKey}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          • MiniMax 模型: {autoStartConfig.openclawMinimaxModel || projectDefaults.minimaxModel || 'MiniMax-M1'}
                          <SourceBadge 
                            source={getFieldSource(autoStartConfig.openclawMinimaxModel, projectDefaults.minimaxModel)} 
                            defaultSource={projectDefaults.sources.minimaxModel}
                          />
                        </div>
                      </>
                    )}
                    {autoStartConfig.openclawModelProvider === 'local' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          • 服务地址: {autoStartConfig.openclawLocalBaseUrl || projectDefaults.localBaseUrl || '未配置'}
                          <SourceBadge 
                            source={getFieldSource(autoStartConfig.openclawLocalBaseUrl, projectDefaults.localBaseUrl)} 
                            defaultSource={projectDefaults.sources.localBaseUrl}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          • 模型名: {autoStartConfig.openclawLocalModelName || projectDefaults.localModelName || '未配置'}
                          <SourceBadge 
                            source={getFieldSource(autoStartConfig.openclawLocalModelName, projectDefaults.localModelName)} 
                            defaultSource={projectDefaults.sources.localModelName}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          • API Key: {(autoStartConfig.openclawLocalApiKey || projectDefaults.localApiKey) ? '✅ 已配置' : '❌ 未配置（可选）'}
                          <SourceBadge 
                            source={getFieldSource(autoStartConfig.openclawLocalApiKey, projectDefaults.localApiKey)} 
                            defaultSource={projectDefaults.sources.localApiKey}
                          />
                        </div>
                      </>
                    )}
                    <div>• 自动启动 Crabwalk: {autoStartConfig.autoStartCrabwalk ? '✅' : '❌'} {autoStartConfig.autoStartCrabwalk && autoStartConfig.autoOpenCrabwalkPanel && '(自动打开面板)'}</div>
                  </div>
                </div>

                {/* 自动启动日志 */}
                {autoStartLogs.length > 0 && (
                  <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ color: '#333' }}>自动启动日志</h4>
                      <button 
                        className="btn btn-small" 
                        onClick={() => setAutoStartLogs([])}
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      >
                        清空
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666', maxHeight: '150px', overflow: 'auto', backgroundColor: '#fff', padding: '10px', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {autoStartLogs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '4px' }}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 日志标签页 */}
        {activeTab === 'logs' && (
          <div className="tab-content">
            <div className="logs-container">
              <div className="logs-header">
                <h3>应用日志</h3>
                <button
                  className="btn btn-small"
                  onClick={() => {
                    setLogs([])
                    addLog('日志已清空')
                  }}
                >
                  清空
                </button>
              </div>
              <div className="logs-output">
                {logs.map((log, index) => (
                  <div key={index} className="log-line">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {loading && <div className="loading-overlay">加载中...</div>}
    </div>
  )
}

export default App
