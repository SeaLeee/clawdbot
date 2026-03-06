import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Mock API for browser environment (when not running in Electron)
if (!window.api) {
  window.api = {
    startOpenClaw: async () => ({ success: true, message: "✓ OpenClaw 已启动（演示模式）" }),
    startCrabwalk: async () => ({ success: true, message: "✓ Crabwalk 已启动（演示模式）" }),
    stopProcess: async () => ({ success: true, message: "进程已停止" }),
    getProcessStatus: async () => ({ openclaw: true, crabwalk: true }),
    checkLaunchAgent: async () => ({ enabled: false }),
    enableLaunchAgent: async () => ({ success: true, message: "✓ LaunchAgent 已启用（演示模式）" }),
    disableLaunchAgent: async () => ({
      success: true,
      message: "✓ LaunchAgent 已禁用（演示模式）",
    }),
    getPaths: async () => ({
      home: "/Users/yourname",
      appPath: "/path/to/clawdbot/plugin/Launcher",
      openclawPath: "/path/to/clawdbot",
      crabwalkPath: "/path/to/crabwalk",
    }),
    getOpenClawPanelUrl: async () => ({
      success: true,
      url: "http://127.0.0.1:18789/chat?session=main",
      port: 18789,
      host: "127.0.0.1",
      source: "config",
      message: "✓ 从配置文件检测到 OpenClaw 面板 (127.0.0.1:18789)",
    }),
    getCrabwalkPanelUrl: async () => ({
      success: true,
      url: "http://localhost:3000",
      port: 3000,
      host: "localhost",
      source: "detected",
      message: "✓ 自动检测到 Crabwalk 面板 (localhost:3000)",
    }),
    waitAndOpenOpenClaw: async () => ({
      success: true,
      url: "http://127.0.0.1:18789/chat?session=main",
      port: 18789,
      host: "127.0.0.1",
      source: "config",
    }),
    waitAndOpenCrabwalk: async () => ({
      success: true,
      url: "http://localhost:3000",
      port: 3000,
      host: "localhost",
      source: "detected",
    }),
    openInSafari: async () => ({ success: true }),
    oneClickOpenOpenClaw: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
        success: true,
        url: "http://127.0.0.1:18789/chat?session=main",
        alreadyRunning: true,
      };
    },
    oneClickOpenCrabwalk: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, url: "http://localhost:3000", alreadyRunning: true };
    },
    oneClickOpenAll: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return {
        openclaw: { success: true, url: "http://127.0.0.1:18789/chat?session=main" },
        crabwalk: { success: true, url: "http://localhost:3000" },
      };
    },
    oneClickOpenSkillDashboard: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      window.open("http://127.0.0.1:18789/skills-dashboard.html", "_blank");
      return {
        success: true,
        url: "http://127.0.0.1:18789/skills-dashboard.html",
        alreadyRunning: true,
      };
    },
    getAutoStartConfig: async () => ({
      success: true,
      config: JSON.parse(localStorage.getItem("clawdbot-launcher-config") || "{}"),
      configPath: "localStorage",
    }),
    saveAutoStartConfig: async (config: any) => {
      const current = JSON.parse(localStorage.getItem("clawdbot-launcher-config") || "{}");
      const newConfig = { ...current, ...config };
      localStorage.setItem("clawdbot-launcher-config", JSON.stringify(newConfig));
      return { success: true, config: newConfig };
    },
    onServiceStarted: () => () => {},
    onOneClickProgress: () => () => {},
    getProjectDefaults: async () => ({
      success: true,
      defaults: {
        gatewayToken: "",
        minimaxApiKey: "",
        minimaxModel: "MiniMax-M1",
        localBaseUrl: "http://127.0.0.1:11434/v1",
        localModelName: "",
        localApiKey: "",
        modelProvider: "" as const,
        sources: {},
      },
    }),
    getEffectiveConfig: async () => ({
      success: true,
      effective: {},
      userConfig: {} as any,
      projectDefaults: {} as any,
    }),
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
