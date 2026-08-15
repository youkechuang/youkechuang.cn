(function () {
  const DAYS_KEY = "ykc-focus.days.v1";
  const ACTIVE_KEY = "ykc-focus.active.v1";
  const SETTINGS_KEY = "ykc-focus.settings.v1";
  const DEFAULT_INTERVAL_MINUTES = 15;

  if (location.pathname.startsWith("/static/focus/")) return;

  let soundTimer = null;
  let audioContext = null;

  document.addEventListener("DOMContentLoaded", initGlobalFocusReminder);

  function initGlobalFocusReminder() {
    injectStyles();
    injectModal();
    window.setInterval(checkReminder, 1000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkReminder();
    });
    checkReminder();
  }

  function checkReminder() {
    const active = loadJson(ACTIVE_KEY, null);
    if (!active) return;
    if (active.state === "pending") {
      showModal();
      return;
    }
    if (active.state !== "running" || !active.targetAt) return;
    if (Date.now() < new Date(active.targetAt).getTime()) return;

    active.state = "pending";
    active.pendingStartedAt = active.startedAt || new Date(Date.now() - getIntervalMs()).toISOString();
    active.pendingEndedAt = active.targetAt;
    active.targetAt = null;
    active.remainingMs = null;
    saveJson(ACTIVE_KEY, active);
    showModal();
  }

  function injectModal() {
    if (document.querySelector("#globalFocusReminder")) return;
    const modal = document.createElement("div");
    modal.id = "globalFocusReminder";
    modal.className = "gfr-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="gfr-dialog" role="dialog" aria-modal="true" aria-labelledby="gfrTitle">
        <p class="gfr-kicker">15 分钟到了</p>
        <h2 id="gfrTitle">现在记录一下</h2>
        <p class="gfr-copy">请填写当前工作和进度。保存后自动进入下一轮。</p>
        <form id="gfrForm" class="gfr-form">
          <label>当前工作<input id="gfrWork" type="text" maxlength="120" placeholder="现在正在做什么？" /></label>
          <label>进度怎么样<textarea id="gfrProgress" rows="3" maxlength="240" placeholder="进展、卡点、下一步"></textarea></label>
          <select id="gfrPlan" aria-label="关联计划"><option value="">不关联计划</option></select>
          <button type="submit">保存并下一轮</button>
        </form>
        <div class="gfr-actions">
          <a href="/static/focus/index.html">打开完整记录页</a>
          <button id="gfrLater" type="button">稍后记录</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("#gfrForm").addEventListener("submit", saveFromModal);
    modal.querySelector("#gfrLater").addEventListener("click", hideModal);
  }

  function showModal() {
    const modal = document.querySelector("#globalFocusReminder");
    if (!modal) return;
    renderPlanOptions();
    modal.hidden = false;
    document.body.classList.add("gfr-open");
    document.title = "该记录了 - 15分钟计划记录";
    startSound();
    window.setTimeout(() => modal.querySelector("#gfrWork")?.focus(), 50);
  }

  function hideModal() {
    const modal = document.querySelector("#globalFocusReminder");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("gfr-open");
    stopSound();
  }

  function renderPlanOptions() {
    const select = document.querySelector("#gfrPlan");
    if (!select) return;
    const days = loadJson(DAYS_KEY, {});
    const today = getDateKey();
    const plans = days[today]?.plans || [];
    select.replaceChildren(
      createOption("", "不关联计划"),
      ...plans.map((plan) => createOption(plan.id, plan.done ? `已完成：${plan.text}` : plan.text)),
    );
  }

  function saveFromModal(event) {
    event.preventDefault();
    const modal = document.querySelector("#globalFocusReminder");
    const workEl = modal.querySelector("#gfrWork");
    const progressEl = modal.querySelector("#gfrProgress");
    const planEl = modal.querySelector("#gfrPlan");
    const work = workEl.value.trim();
    const progress = progressEl.value.trim();
    if (!work) {
      workEl.focus();
      return;
    }
    if (!progress) {
      progressEl.focus();
      return;
    }

    const days = loadJson(DAYS_KEY, {});
    const today = getDateKey();
    if (!days[today]) days[today] = { plans: [], logs: [] };
    const active = loadJson(ACTIVE_KEY, createIdleActive());
    const now = new Date();
    const endedAt = active.pendingEndedAt || now.toISOString();
    const startedAt = active.pendingStartedAt || new Date(now.getTime() - getIntervalMs()).toISOString();
    days[today].logs.push({
      id: createId("log"),
      startedAt,
      endedAt,
      work,
      progress,
      text: `${work}｜${progress}`,
      planId: planEl.value || "",
    });
    saveJson(DAYS_KEY, days);

    const next = createIdleActive();
    next.state = "running";
    next.round = days[today].logs.length + 1;
    next.startedAt = new Date().toISOString();
    next.targetAt = new Date(Date.now() + getIntervalMs()).toISOString();
    saveJson(ACTIVE_KEY, next);

    workEl.value = "";
    progressEl.value = "";
    hideModal();
  }

  function injectStyles() {
    if (document.querySelector("#globalFocusReminderStyle")) return;
    const style = document.createElement("style");
    style.id = "globalFocusReminderStyle";
    style.textContent = `
      .gfr-modal{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.74);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#17212b}
      .gfr-modal[hidden]{display:none}
      .gfr-dialog{width:min(520px,100%);padding:22px;border-radius:8px;background:#fff;box-shadow:0 28px 70px rgba(0,0,0,.3)}
      .gfr-kicker{margin:0 0 6px;color:#dc2626;font-size:.88rem;font-weight:950}
      .gfr-dialog h2{margin:0;font-size:1.85rem;line-height:1.2}
      .gfr-copy{margin:8px 0 0;color:#667384;line-height:1.55}
      .gfr-form{display:grid;gap:10px;margin-top:14px}
      .gfr-form label{display:grid;gap:6px;color:#334155;font-size:.86rem;font-weight:900}
      .gfr-form input,.gfr-form textarea,.gfr-form select{width:100%;border:1px solid #d9e4e2;border-radius:8px;background:#fff;color:#17212b;font:inherit;outline:none}
      .gfr-form input,.gfr-form select{min-height:42px;padding:0 11px}
      .gfr-form textarea{resize:vertical;padding:11px;line-height:1.5}
      .gfr-form button{min-height:42px;border:1px solid #0f766e;border-radius:8px;background:#0f766e;color:#fff;font:inherit;font-weight:950;cursor:pointer}
      .gfr-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .gfr-actions a,.gfr-actions button{display:grid;place-items:center;min-height:38px;border:1px solid #d9e4e2;border-radius:8px;background:#fff;color:#115e59;font:inherit;font-weight:900;text-decoration:none;cursor:pointer}
      @media(max-width:560px){.gfr-dialog{padding:18px}.gfr-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function playSound() {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 760;
      gain.gain.setValueAtTime(0.001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.42);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.45);
    } catch {
      // Best effort.
    }
  }

  function startSound() {
    playSound();
    if (soundTimer) return;
    soundTimer = window.setInterval(playSound, 3500);
  }

  function stopSound() {
    if (soundTimer) window.clearInterval(soundTimer);
    soundTimer = null;
  }

  function getIntervalMs() {
    const settings = loadJson(SETTINGS_KEY, {});
    return (settings.intervalMinutes || DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
  }

  function createIdleActive() {
    return {
      state: "idle",
      date: getDateKey(),
      round: 0,
      startedAt: null,
      targetAt: null,
      remainingMs: null,
      pendingStartedAt: null,
      pendingEndedAt: null,
    };
  }

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : clone(fallback);
    } catch {
      return clone(fallback);
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function createOption(value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    return option;
  }
})();
