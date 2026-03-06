// @ts-nocheck
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const {
  createLaunchAgent,
  removeLaunchAgent,
  isLaunchAgentEnabled,
} = require("./utils/launchAgent");
const {
  startOpenClaw,
  startCrabwalk,
  stopProcess,
  getProcessStatus,
} = require("./utils/processManager");
const {
  detectOpenClawPanel,
  detectCrabwalkPanel,
  waitForService,
} = require("./utils/panelDetector");
const {
  readAutoStartConfig,
  saveAutoStartConfig,
  getConfigFilePath,
} = require("./utils/autoStartConfig");
const { getProjectDefaults, getEffectiveValue } = require("./utils/projectDefaults");

let mainWindow: BrowserWindow | null = null;
let openclawProcess: unknown = null;
let crabwalkProcess: unknown = null;
let autoStartExecuted = false;

function openInSafari(url: string) {
  if (!url) {
    return;
  }
  try {
    const child = spawn("open", ["-a", "Safari", url], { stdio: "ignore", detached: true });
    child.unref();
  } catch {
    shell.openExternal(url);
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    mainWindow.loadURL(isDev);
    // 只在开发环境中打开 DevTools
    if (process.env.NODE_ENV === "development") {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, "renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// 应用启动
app.on("ready", async () => {
  createWindow();

  // 执行自动启动逻辑
  await executeAutoStart();
});

/**
 * 执行自动启动逻辑
 */
async function executeAutoStart() {
  if (autoStartExecuted) {
    return;
  }
  autoStartExecuted = true;

  try {
    const config = await readAutoStartConfig();
    console.log("自动启动配置:", config);

    // 等待窗口加载完成
    if (mainWindow) {
      mainWindow.webContents.once("did-finish-load", async () => {
        // 自动启动 OpenClaw
        if (config.autoStartOpenClaw) {
          console.log("自动启动 OpenClaw...");
          try {
            const defaults = getProjectDefaults();
            openclawProcess = await startOpenClaw({
              gatewayToken: config.openclawGatewayToken || defaults.gatewayToken,
              modelProvider: config.openclawModelProvider || defaults.modelProvider || "minimax",
              minimaxApiKey: config.openclawMinimaxApiKey || defaults.minimaxApiKey,
              minimaxModel: config.openclawMinimaxModel || defaults.minimaxModel,
              localBaseUrl: config.openclawLocalBaseUrl || defaults.localBaseUrl,
              localModelName: config.openclawLocalModelName || defaults.localModelName,
              localApiKey: config.openclawLocalApiKey || defaults.localApiKey,
            });
            mainWindow?.webContents.send("service-started", { name: "openclaw", success: true });

            // 自动打开面板
            if (config.autoOpenOpenClawPanel) {
              const result = await waitForService("openclaw", 30000, 1000);
              if (result.success && result.url) {
                openInSafari(result.url);
              }
            }
          } catch (error) {
            console.error("自动启动 OpenClaw 失败:", error);
            mainWindow?.webContents.send("service-started", {
              name: "openclaw",
              success: false,
              error: String(error),
            });
          }
        }

        // 自动启动 Crabwalk
        if (config.autoStartCrabwalk) {
          console.log("自动启动 Crabwalk...");
          try {
            crabwalkProcess = await startCrabwalk();
            mainWindow?.webContents.send("service-started", { name: "crabwalk", success: true });

            // 自动打开面板
            if (config.autoOpenCrabwalkPanel) {
              const result = await waitForService("crabwalk", 30000, 1000);
              if (result.success && result.url) {
                shell.openExternal(result.url);
              }
            }
          } catch (error) {
            console.error("自动启动 Crabwalk 失败:", error);
            mainWindow?.webContents.send("service-started", {
              name: "crabwalk",
              success: false,
              error: String(error),
            });
          }
        }
      });
    }
  } catch (error) {
    console.error("执行自动启动失败:", error);
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC 处理器

// 获取项目默认配置
ipcMain.handle("get-project-defaults", async () => {
  try {
    const defaults = getProjectDefaults();
    return { success: true, defaults };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// 获取有效配置（用户配置 + 项目默认 fallback）
ipcMain.handle("get-effective-config", async () => {
  try {
    const config = await readAutoStartConfig();
    const defaults = getProjectDefaults();

    const effective = {
      gatewayToken: getEffectiveValue(config.openclawGatewayToken, defaults.gatewayToken),
      modelProvider: config.openclawModelProvider || defaults.modelProvider || "minimax",
      minimaxApiKey: getEffectiveValue(config.openclawMinimaxApiKey, defaults.minimaxApiKey),
      minimaxModel: getEffectiveValue(config.openclawMinimaxModel, defaults.minimaxModel),
      localBaseUrl: getEffectiveValue(config.openclawLocalBaseUrl, defaults.localBaseUrl),
      localModelName: getEffectiveValue(config.openclawLocalModelName, defaults.localModelName),
      localApiKey: getEffectiveValue(config.openclawLocalApiKey, defaults.localApiKey),
    };

    return { success: true, effective, userConfig: config, projectDefaults: defaults };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// 启动 OpenClaw
ipcMain.handle("start-openclaw", async () => {
  try {
    const config = await readAutoStartConfig();
    const defaults = getProjectDefaults();

    // 用户填写了就用用户的，没填写就用项目默认的
    const gatewayToken = config.openclawGatewayToken || defaults.gatewayToken;
    const modelProvider = config.openclawModelProvider || defaults.modelProvider || "minimax";
    const minimaxApiKey = config.openclawMinimaxApiKey || defaults.minimaxApiKey;
    const minimaxModel = config.openclawMinimaxModel || defaults.minimaxModel;
    const localBaseUrl = config.openclawLocalBaseUrl || defaults.localBaseUrl;
    const localModelName = config.openclawLocalModelName || defaults.localModelName;
    const localApiKey = config.openclawLocalApiKey || defaults.localApiKey;

    openclawProcess = await startOpenClaw({
      gatewayToken,
      modelProvider,
      minimaxApiKey,
      minimaxModel,
      localBaseUrl,
      localModelName,
      localApiKey,
    });
    return { success: true, message: "OpenClaw 已启动" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// 启动 Crabwalk
ipcMain.handle("start-crabwalk", async () => {
  try {
    crabwalkProcess = await startCrabwalk();
    return { success: true, message: "Crabwalk 已启动" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// 停止进程
ipcMain.handle("stop-process", async (event, processName: string) => {
  try {
    if (processName === "openclaw" && openclawProcess) {
      stopProcess(openclawProcess);
      openclawProcess = null;
      return { success: true, message: "OpenClaw 已停止" };
    } else if (processName === "crabwalk" && crabwalkProcess) {
      stopProcess(crabwalkProcess);
      crabwalkProcess = null;
      return { success: true, message: "Crabwalk 已停止" };
    }
    return { success: false, error: "进程不存在" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// 获取进程状态
ipcMain.handle("get-process-status", async () => {
  try {
    const openclawStatus = getProcessStatus(openclawProcess);
    const crabwalkStatus = getProcessStatus(crabwalkProcess);
    return {
      openclaw: openclawStatus,
      crabwalk: crabwalkStatus,
    };
  } catch (error) {
    return { error: String(error) };
  }
});

// LaunchAgent 相关
ipcMain.handle("check-launch-agent", async () => {
  try {
    const enabled = await isLaunchAgentEnabled();
    return { enabled };
  } catch (error) {
    return { error: String(error) };
  }
});

ipcMain.handle("enable-launch-agent", async () => {
  try {
    await createLaunchAgent();
    return { success: true, message: "LaunchAgent 已启用" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("disable-launch-agent", async () => {
  try {
    await removeLaunchAgent();
    return { success: true, message: "LaunchAgent 已禁用" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// 获取应用路径
ipcMain.handle("get-paths", async () => {
  return {
    home: os.homedir(),
    appPath: app.getAppPath(),
    openclawPath: path.join(os.homedir(), "Desktop/github/clawdbot"),
    crabwalkPath: path.join(os.homedir(), "Desktop/github/crabwalk"),
  };
});

// 获取 OpenClaw 交互面板地址
ipcMain.handle("get-openclaw-panel-url", async () => {
  try {
    const result = await detectOpenClawPanel();
    return {
      success: result.url !== null,
      url: result.url || "http://127.0.0.1:18789/chat?session=main",
      port: result.port,
      host: result.host,
      source: result.source,
      message:
        result.source === "config"
          ? `✓ 从配置文件检测到 OpenClaw 面板 (${result.host}:${result.port})`
          : result.source === "detected"
            ? `✓ 自动检测到 OpenClaw 面板 (${result.host}:${result.port})`
            : `⚠️ 使用配置的 OpenClaw 地址 (${result.host}:${result.port})`,
    };
  } catch (error) {
    return {
      success: false,
      url: "http://127.0.0.1:18789/chat?session=main",
      port: 18789,
      host: "127.0.0.1",
      source: "fallback",
      error: String(error),
    };
  }
});

// 获取 Crabwalk 交互面板地址
ipcMain.handle("get-crabwalk-panel-url", async () => {
  try {
    const result = await detectCrabwalkPanel();
    return {
      success: result.url !== null,
      url: result.url || "http://localhost:5173",
      port: result.port,
      host: result.host,
      source: result.source,
      message:
        result.source === "config"
          ? `✓ 从项目配置检测到 Crabwalk 面板 (${result.host}:${result.port})`
          : result.source === "detected"
            ? `✓ 自动检测到 Crabwalk 面板 (${result.host}:${result.port})`
            : `⚠️ 使用 Crabwalk 默认地址 (${result.host}:${result.port})`,
    };
  } catch (error) {
    return {
      success: false,
      url: "http://localhost:5173",
      port: 5173,
      host: "localhost",
      source: "fallback",
      error: String(error),
    };
  }
});

// 等待并打开 OpenClaw 面板
ipcMain.handle("wait-and-open-openclaw", async () => {
  try {
    const result = await waitForService("openclaw", 30000, 1000);
    if (result.success && result.url) {
      openInSafari(result.url);
    }
    return result;
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

// 等待并打开 Crabwalk 面板
ipcMain.handle("wait-and-open-crabwalk", async () => {
  try {
    const result = await waitForService("crabwalk", 30000, 1000);
    if (result.success && result.url) {
      openInSafari(result.url);
    }
    return result;
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

// 自动启动配置管理 IPC
ipcMain.handle("get-autostart-config", async () => {
  try {
    const config = await readAutoStartConfig();
    return { success: true, config, configPath: getConfigFilePath() };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("save-autostart-config", async (event, config: Partial<AutoStartConfig>) => {
  try {
    const newConfig = await saveAutoStartConfig(config);
    return { success: true, config: newConfig };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("open-in-safari", async (event, url: string) => {
  try {
    openInSafari(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// 一键打开 OpenClaw：启动（若未运行）+ 等待就绪 + 打开面板
ipcMain.handle("one-click-open-openclaw", async () => {
  try {
    const status = getProcessStatus(openclawProcess);

    // 步骤1: 如果未运行，先启动
    if (!status) {
      mainWindow?.webContents.send("one-click-progress", {
        service: "openclaw",
        step: "starting",
        message: "正在启动 OpenClaw...",
      });

      const config = await readAutoStartConfig();
      const defaults = getProjectDefaults();
      openclawProcess = await startOpenClaw({
        gatewayToken: config.openclawGatewayToken || defaults.gatewayToken,
        modelProvider: config.openclawModelProvider || defaults.modelProvider || "minimax",
        minimaxApiKey: config.openclawMinimaxApiKey || defaults.minimaxApiKey,
        minimaxModel: config.openclawMinimaxModel || defaults.minimaxModel,
        localBaseUrl: config.openclawLocalBaseUrl || defaults.localBaseUrl,
        localModelName: config.openclawLocalModelName || defaults.localModelName,
        localApiKey: config.openclawLocalApiKey || defaults.localApiKey,
      });
    }

    // 步骤2: 等待服务就绪
    mainWindow?.webContents.send("one-click-progress", {
      service: "openclaw",
      step: "waiting",
      message: "等待服务就绪...",
    });
    const result = await waitForService("openclaw", 30000, 1000);

    // 步骤3: 打开面板
    if (result.success && result.url) {
      mainWindow?.webContents.send("one-click-progress", {
        service: "openclaw",
        step: "opening",
        message: "正在打开面板...",
      });
      openInSafari(result.url);
      mainWindow?.webContents.send("one-click-progress", {
        service: "openclaw",
        step: "done",
        message: "已打开 OpenClaw 面板",
      });
      return { success: true, url: result.url, alreadyRunning: status };
    } else {
      // 服务未就绪，尝试用 fallback URL 打开
      const fallbackUrl = "http://127.0.0.1:18789/chat?session=main";
      openInSafari(fallbackUrl);
      mainWindow?.webContents.send("one-click-progress", {
        service: "openclaw",
        step: "done",
        message: "已打开 OpenClaw 面板（默认地址）",
      });
      return { success: true, url: fallbackUrl, alreadyRunning: status, fallback: true };
    }
  } catch (error) {
    mainWindow?.webContents.send("one-click-progress", {
      service: "openclaw",
      step: "error",
      message: `启动失败: ${error}`,
    });
    return { success: false, error: String(error) };
  }
});

// 一键打开 Crabwalk：启动（若未运行）+ 等待就绪 + 打开面板
ipcMain.handle("one-click-open-crabwalk", async () => {
  try {
    const status = getProcessStatus(crabwalkProcess);

    // 步骤1: 如果未运行，先启动
    if (!status) {
      mainWindow?.webContents.send("one-click-progress", {
        service: "crabwalk",
        step: "starting",
        message: "正在启动 Crabwalk...",
      });
      crabwalkProcess = await startCrabwalk();
    }

    // 步骤2: 等待服务就绪
    mainWindow?.webContents.send("one-click-progress", {
      service: "crabwalk",
      step: "waiting",
      message: "等待服务就绪...",
    });
    const result = await waitForService("crabwalk", 30000, 1000);

    // 步骤3: 打开面板
    if (result.success && result.url) {
      mainWindow?.webContents.send("one-click-progress", {
        service: "crabwalk",
        step: "opening",
        message: "正在打开面板...",
      });
      openInSafari(result.url);
      mainWindow?.webContents.send("one-click-progress", {
        service: "crabwalk",
        step: "done",
        message: "已打开 Crabwalk 面板",
      });
      return { success: true, url: result.url, alreadyRunning: status };
    } else {
      const fallbackUrl = "http://localhost:5173";
      openInSafari(fallbackUrl);
      mainWindow?.webContents.send("one-click-progress", {
        service: "crabwalk",
        step: "done",
        message: "已打开 Crabwalk 面板（默认地址）",
      });
      return { success: true, url: fallbackUrl, alreadyRunning: status, fallback: true };
    }
  } catch (error) {
    mainWindow?.webContents.send("one-click-progress", {
      service: "crabwalk",
      step: "error",
      message: `启动失败: ${error}`,
    });
    return { success: false, error: String(error) };
  }
});

// 一键打开 Skill Dashboard：确保 OpenClaw 运行 + 打开 skills-dashboard.html
ipcMain.handle("one-click-open-skill-dashboard", async () => {
  try {
    const status = getProcessStatus(openclawProcess);

    // 步骤1: 如果 OpenClaw 未运行，先启动
    if (!status) {
      mainWindow?.webContents.send("one-click-progress", {
        service: "skill-dashboard",
        step: "starting",
        message: "正在启动 OpenClaw...",
      });
      const config = await readAutoStartConfig();
      const defaults = getProjectDefaults();
      openclawProcess = await startOpenClaw({
        gatewayToken: config.openclawGatewayToken || defaults.gatewayToken,
        modelProvider: config.openclawModelProvider || defaults.modelProvider || "minimax",
        minimaxApiKey: config.openclawMinimaxApiKey || defaults.minimaxApiKey,
        minimaxModel: config.openclawMinimaxModel || defaults.minimaxModel,
        localBaseUrl: config.openclawLocalBaseUrl || defaults.localBaseUrl,
        localModelName: config.openclawLocalModelName || defaults.localModelName,
        localApiKey: config.openclawLocalApiKey || defaults.localApiKey,
      });
    }

    // 步骤2: 等待服务就绪
    mainWindow?.webContents.send("one-click-progress", {
      service: "skill-dashboard",
      step: "waiting",
      message: "等待服务就绪...",
    });
    const result = await waitForService("openclaw", 30000, 1000);

    // 步骤3: 打开 skill dashboard 页面
    const baseUrl =
      result.success && result.url ? result.url.replace(/\/chat.*$/, "") : "http://127.0.0.1:18789";
    const dashboardUrl = baseUrl + "/skills-dashboard.html";
    mainWindow?.webContents.send("one-click-progress", {
      service: "skill-dashboard",
      step: "opening",
      message: "正在打开 Skill Dashboard...",
    });
    openInSafari(dashboardUrl);
    mainWindow?.webContents.send("one-click-progress", {
      service: "skill-dashboard",
      step: "done",
      message: "已打开 Skill Dashboard",
    });
    return { success: true, url: dashboardUrl, alreadyRunning: status };
  } catch (error) {
    mainWindow?.webContents.send("one-click-progress", {
      service: "skill-dashboard",
      step: "error",
      message: `启动失败: ${error}`,
    });
    return { success: false, error: String(error) };
  }
});

// 一键全部打开：同时启动并打开 OpenClaw 和 Crabwalk
ipcMain.handle("one-click-open-all", async () => {
  const results = { openclaw: null as any, crabwalk: null as any };

  mainWindow?.webContents.send("one-click-progress", {
    service: "all",
    step: "starting",
    message: "正在启动所有服务...",
  });

  // 并行启动两个服务
  const [openclawResult, crabwalkResult] = await Promise.allSettled([
    (async () => {
      const status = getProcessStatus(openclawProcess);
      if (!status) {
        const config = await readAutoStartConfig();
        const defaults = getProjectDefaults();
        openclawProcess = await startOpenClaw({
          gatewayToken: config.openclawGatewayToken || defaults.gatewayToken,
          modelProvider: config.openclawModelProvider || defaults.modelProvider || "minimax",
          minimaxApiKey: config.openclawMinimaxApiKey || defaults.minimaxApiKey,
          minimaxModel: config.openclawMinimaxModel || defaults.minimaxModel,
          localBaseUrl: config.openclawLocalBaseUrl || defaults.localBaseUrl,
          localModelName: config.openclawLocalModelName || defaults.localModelName,
          localApiKey: config.openclawLocalApiKey || defaults.localApiKey,
        });
      }
      const result = await waitForService("openclaw", 30000, 1000);
      if (result.success && result.url) {
        openInSafari(result.url);
        return { success: true, url: result.url };
      }
      const fallbackUrl = "http://127.0.0.1:18789/chat?session=main";
      openInSafari(fallbackUrl);
      return { success: true, url: fallbackUrl, fallback: true };
    })(),
    (async () => {
      const status = getProcessStatus(crabwalkProcess);
      if (!status) {
        crabwalkProcess = await startCrabwalk();
      }
      const result = await waitForService("crabwalk", 30000, 1000);
      if (result.success && result.url) {
        openInSafari(result.url);
        return { success: true, url: result.url };
      }
      const fallbackUrl = "http://localhost:5173";
      openInSafari(fallbackUrl);
      return { success: true, url: fallbackUrl, fallback: true };
    })(),
  ]);

  results.openclaw =
    openclawResult.status === "fulfilled"
      ? openclawResult.value
      : { success: false, error: String((openclawResult as any).reason) };
  results.crabwalk =
    crabwalkResult.status === "fulfilled"
      ? crabwalkResult.value
      : { success: false, error: String((crabwalkResult as any).reason) };

  mainWindow?.webContents.send("one-click-progress", {
    service: "all",
    step: "done",
    message: "所有服务已启动",
  });

  return results;
});

// 清理：关闭时停止所有进程
app.on("before-quit", () => {
  if (openclawProcess) {
    stopProcess(openclawProcess);
  }
  if (crabwalkProcess) {
    stopProcess(crabwalkProcess);
  }
});
