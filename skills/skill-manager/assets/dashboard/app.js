/**
 * Skill Manager Dashboard — Frontend Logic
 */

(function () {
  "use strict";

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  let allSkills = [];
  let currentFilter = "all";

  // -----------------------------------------------------------------------
  // DOM References
  // -----------------------------------------------------------------------

  const skillGrid = document.getElementById("skillGrid");
  const searchInput = document.getElementById("search");
  const modalOverlay = document.getElementById("modalOverlay");
  const modal = document.getElementById("modal");
  const modalClose = document.getElementById("modalClose");
  const modalTitle = document.getElementById("modalTitle");
  const modalBadge = document.getElementById("modalBadge");
  const modalDesc = document.getElementById("modalDesc");
  const modalMeta = document.getElementById("modalMeta");
  const modalContent = document.getElementById("modalContent");
  const btnScan = document.getElementById("btnScan");
  const scanResult = document.getElementById("scanResult");
  const statTotal = document.getElementById("stat-total");
  const statFiles = document.getElementById("stat-files");
  const filterBtns = document.querySelectorAll(".filter-btn");

  // -----------------------------------------------------------------------
  // Default Emojis by name pattern
  // -----------------------------------------------------------------------

  const EMOJI_MAP = {
    "skill-manager": "🤖",
    "skill-creator": "🛠️",
    "skill-security": "🛡️",
    github: "🐙",
    slack: "💬",
    discord: "🎮",
    weather: "🌤️",
    spotify: "🎵",
    coding: "🧩",
    notion: "📝",
    obsidian: "💎",
    trello: "📋",
    canvas: "🎨",
    voice: "📞",
    video: "🎬",
    image: "🖼️",
    pdf: "📄",
    email: "📧",
    himalaya: "📧",
    gemini: "♊",
    oracle: "🔮",
    openai: "🧠",
    bear: "🐻",
    apple: "🍎",
    tmux: "🖥️",
    sonos: "🔊",
    healthcheck: "💚",
    summarize: "📰",
    session: "📜",
    model: "📊",
  };

  function getEmoji(skill) {
    if (skill.emoji) return skill.emoji;
    const name = skill.name.toLowerCase();
    for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
      if (name.includes(key)) return emoji;
    }
    return "📦";
  }

  // -----------------------------------------------------------------------
  // API
  // -----------------------------------------------------------------------

  async function fetchSkills() {
    try {
      const resp = await fetch("/api/skills");
      allSkills = await resp.json();
      renderSkills();
      updateStats();
    } catch (e) {
      skillGrid.innerHTML =
        '<div class="loading">⚠️ 无法加载skill列表，请确认服务正在运行</div>';
    }
  }

  async function fetchStats() {
    try {
      const resp = await fetch("/api/stats");
      const stats = await resp.json();
      statTotal.textContent = `📦 ${stats.total} 个Skills`;
      statFiles.textContent = `📄 ${stats.total_files} 个文件`;
    } catch (e) {
      // Silently ignore
    }
  }

  async function fetchSkillDetail(name) {
    try {
      const resp = await fetch(`/api/skill?name=${encodeURIComponent(name)}`);
      return await resp.json();
    } catch (e) {
      return null;
    }
  }

  async function scanSkill(name) {
    try {
      const resp = await fetch(`/api/scan?name=${encodeURIComponent(name)}`);
      return await resp.json();
    } catch (e) {
      return { error: "Scan failed" };
    }
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  function renderSkills() {
    const query = searchInput.value.toLowerCase().trim();
    let filtered = allSkills;

    // Apply text search
    if (query) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.description || "").toLowerCase().includes(query)
      );
    }

    // Apply filter
    if (currentFilter !== "all") {
      const filterMap = {
        scripts: "has_scripts",
        references: "has_references",
        assets: "has_assets",
      };
      const key = filterMap[currentFilter];
      if (key) filtered = filtered.filter((s) => s[key]);
    }

    if (filtered.length === 0) {
      skillGrid.innerHTML =
        '<div class="loading">🔍 没有找到匹配的skill</div>';
      return;
    }

    skillGrid.innerHTML = filtered.map((s) => createCard(s)).join("");

    // Bind click events
    skillGrid.querySelectorAll(".skill-card").forEach((card) => {
      card.addEventListener("click", () => openModal(card.dataset.name));
    });
  }

  function createCard(skill) {
    const emoji = getEmoji(skill);
    const tags = [];
    if (skill.has_scripts)
      tags.push('<span class="skill-tag scripts">📜 scripts</span>');
    if (skill.has_references)
      tags.push('<span class="skill-tag refs">📄 refs</span>');
    if (skill.has_assets)
      tags.push('<span class="skill-tag assets">🎨 assets</span>');

    const desc = skill.description
      ? escapeHtml(truncate(skill.description, 100))
      : "暂无描述";

    return `
      <div class="skill-card" data-name="${escapeHtml(skill.name)}">
        <div class="skill-card-header">
          <span class="skill-emoji">${emoji}</span>
          <span class="skill-name">${escapeHtml(skill.name)}</span>
        </div>
        <p class="skill-desc">${desc}</p>
        <div class="skill-tags">${tags.join("")}</div>
        <div class="skill-meta">
          <span>📄 ${skill.file_count || 0}文件</span>
          <span>📏 ${skill.lines || 0}行</span>
        </div>
      </div>
    `;
  }

  function updateStats() {
    statTotal.textContent = `📦 ${allSkills.length} 个Skills`;
    const totalFiles = allSkills.reduce(
      (sum, s) => sum + (s.file_count || 0),
      0
    );
    statFiles.textContent = `📄 ${totalFiles} 个文件`;
  }

  // -----------------------------------------------------------------------
  // Modal
  // -----------------------------------------------------------------------

  let currentSkillName = "";

  async function openModal(name) {
    currentSkillName = name;
    scanResult.style.display = "none";
    scanResult.className = "scan-result";

    const detail = await fetchSkillDetail(name);
    if (!detail) return;

    const emoji = getEmoji(detail);
    modalTitle.textContent = `${emoji} ${detail.name}`;
    modalBadge.textContent = detail.title || detail.name;
    modalDesc.textContent = detail.description || "暂无描述";

    // Meta info
    const metaItems = [];
    metaItems.push(`<span class="modal-meta-item">📄 ${detail.file_count || 0} 文件</span>`);
    metaItems.push(`<span class="modal-meta-item">📏 ${detail.lines || 0} 行</span>`);
    if (detail.has_scripts)
      metaItems.push('<span class="modal-meta-item">📜 Scripts</span>');
    if (detail.has_references)
      metaItems.push('<span class="modal-meta-item">📄 References</span>');
    if (detail.has_assets)
      metaItems.push('<span class="modal-meta-item">🎨 Assets</span>');
    modalMeta.innerHTML = metaItems.join("");

    // SKILL.md content preview
    if (detail.content) {
      // Remove frontmatter for display
      let display = detail.content.replace(/^---[\s\S]*?---\s*/, "").trim();
      if (display.length > 2000) display = display.slice(0, 2000) + "\n\n... (内容已截断)";
      modalContent.textContent = display;
    } else {
      modalContent.textContent = "无法加载内容";
    }

    modalOverlay.classList.add("active");
  }

  function closeModal() {
    modalOverlay.classList.remove("active");
    currentSkillName = "";
  }

  // -----------------------------------------------------------------------
  // Security Scan
  // -----------------------------------------------------------------------

  btnScan.addEventListener("click", async () => {
    if (!currentSkillName) return;
    btnScan.disabled = true;
    btnScan.textContent = "⏳ 扫描中...";
    scanResult.style.display = "block";
    scanResult.className = "scan-result";
    scanResult.innerHTML = "正在扫描...";

    const result = await scanSkill(currentSkillName);

    btnScan.disabled = false;
    btnScan.textContent = "🔒 安全扫描";

    if (result.error) {
      scanResult.innerHTML = `⚠️ 扫描失败: ${escapeHtml(result.error)}`;
      scanResult.classList.add("scan-warning");
      return;
    }

    const icon =
      result.result === "CLEAN"
        ? "✅"
        : result.result === "BLOCKED"
          ? "⛔"
          : result.result === "FLAGGED"
            ? "⚠️"
            : "🔧";

    const cssClass =
      result.result === "CLEAN"
        ? "scan-clean"
        : result.result === "BLOCKED"
          ? "scan-blocked"
          : "scan-warning";

    let html = `
      <strong>${icon} ${result.result}</strong>
      &nbsp;|&nbsp; 扫描文件: ${result.scanned_files || 0}
      &nbsp;|&nbsp; 隐私评分: ${result.privacy_score ?? "N/A"}/100<br>
      ⛔ Critical: ${result.critical || 0} &nbsp;
      ⚠️ Warning: ${result.warning || 0} &nbsp;
      ℹ️ Info: ${result.info || 0}
    `;

    if (result.findings && result.findings.length > 0) {
      html += "<br><br><strong>发现详情:</strong><br>";
      for (const f of result.findings.slice(0, 10)) {
        const fIcon =
          f.severity === "critical"
            ? "⛔"
            : f.severity === "warning"
              ? "⚠️"
              : "ℹ️";
        html += `${fIcon} <strong>${escapeHtml(f.rule_id)}</strong>: ${escapeHtml(f.message)}<br>`;
        html += `&nbsp;&nbsp;→ ${escapeHtml(truncate(f.evidence, 80))}<br>`;
      }
      if (result.findings.length > 10) {
        html += `<br>... 还有 ${result.findings.length - 10} 个发现`;
      }
    }

    scanResult.innerHTML = html;
    scanResult.classList.add(cssClass);
  });

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  searchInput.addEventListener("input", () => {
    renderSkills();
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderSkills();
    });
  });

  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener("keydown", (e) => { // nosec - UI keyboard navigation only
    if (e.key === "Escape") closeModal();
  });

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function truncate(str, max) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max) + "..." : str;
  }

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------

  fetchSkills();
  fetchStats();
})();
