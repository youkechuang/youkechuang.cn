const SETTINGS_KEY = "ykc-focus.settings.v1";
const DAYS_KEY = "ykc-focus.days.v1";
const ACTIVE_KEY = "ykc-focus.active.v1";
const DEFAULT_INTERVAL_MINUTES = 15;
const CIRCLE_LENGTH = 326.73;

const defaultSettings = {
  intervalMinutes: DEFAULT_INTERVAL_MINUTES,
  soundEnabled: true,
};

let settings = loadJson(SETTINGS_KEY, defaultSettings);
let days = loadJson(DAYS_KEY, {});
let active = loadJson(ACTIVE_KEY, createIdleActive());
let ticker = null;
let audioContext = null;
let reminderSoundTimer = null;

const todayLabelEl = document.querySelector("#todayLabel");
const statusTextEl = document.querySelector("#statusText");
const nextReminderTextEl = document.querySelector("#nextReminderText");
const timerTextEl = document.querySelector("#timerText");
const roundTextEl = document.querySelector("#roundText");
const progressCircleEl = document.querySelector("#progressCircle");
const startButtonEl = document.querySelector("#startButton");
const pauseButtonEl = document.querySelector("#pauseButton");
const finishButtonEl = document.querySelector("#finishButton");
const pendingBoxEl = document.querySelector("#pendingBox");
const planFormEl = document.querySelector("#planForm");
const planInputEl = document.querySelector("#planInput");
const planListEl = document.querySelector("#planList");
const logFormEl = document.querySelector("#logForm");
const workInputEl = document.querySelector("#workInput");
const progressInputEl = document.querySelector("#progressInput");
const planSelectEl = document.querySelector("#planSelect");
const timelineHintEl = document.querySelector("#timelineHint");
const timelineListEl = document.querySelector("#timelineList");
const notifyButtonEl = document.querySelector("#notifyButton");
const exportButtonEl = document.querySelector("#exportButton");
const importButtonEl = document.querySelector("#importButton");
const importFileEl = document.querySelector("#importFile");
const clearButtonEl = document.querySelector("#clearButton");
const historyDateEl = document.querySelector("#historyDate");
const historyViewEl = document.querySelector("#historyView");
const reminderModalEl = document.querySelector("#reminderModal");
const modalLogFormEl = document.querySelector("#modalLogForm");
const modalWorkInputEl = document.querySelector("#modalWorkInput");
const modalProgressInputEl = document.querySelector("#modalProgressInput");
const modalPlanSelectEl = document.querySelector("#modalPlanSelect");
const modalLaterButtonEl = document.querySelector("#modalLaterButton");

ensureToday();
normalizeActive();
bindEvents();
startTicker();
render();

function bindEvents() {
  startButtonEl.addEventListener("click", startOrResume);
  pauseButtonEl.addEventListener("click", pauseTimer);
  finishButtonEl.addEventListener("click", finishToday);
  planFormEl.addEventListener("submit", addPlan);
  logFormEl.addEventListener("submit", addLog);
  modalLogFormEl.addEventListener("submit", addModalLog);
  modalLaterButtonEl.addEventListener("click", hideReminderModal);
  notifyButtonEl.addEventListener("click", requestNotifications);
  exportButtonEl.addEventListener("click", exportData);
  importButtonEl.addEventListener("click", () => importFileEl.click());
  importFileEl.addEventListener("change", importData);
  clearButtonEl.addEventListener("click", clearData);
  historyDateEl.addEventListener("change", renderHistory);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkTimer();
  });
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

function normalizeActive() {
  const today = getDateKey();
  if (!active || active.date !== today) {
    active = createIdleActive();
    saveActive();
  }
}

function ensureToday() {
  const today = getDateKey();
  if (!days[today]) {
    days[today] = {
      plans: [],
      logs: [],
    };
    saveDays();
  }
}

function getToday() {
  ensureToday();
  return days[getDateKey()];
}

function startOrResume() {
  ensureToday();
  const now = Date.now();
  if (active.state === "running") return;

  if (active.state === "pending") {
    showReminderModal();
    workInputEl.focus();
    return;
  }

  const durationMs = active.state === "paused" && active.remainingMs
    ? active.remainingMs
    : settings.intervalMinutes * 60 * 1000;

  active = {
    ...active,
    state: "running",
    date: getDateKey(),
    round: active.round || getToday().logs.length + 1,
    startedAt: active.startedAt || new Date(now).toISOString(),
    targetAt: new Date(now + durationMs).toISOString(),
    remainingMs: null,
  };
  saveActive();
  render();
}

function pauseTimer() {
  if (active.state !== "running") return;
  const remainingMs = Math.max(0, new Date(active.targetAt).getTime() - Date.now());
  active = {
    ...active,
    state: "paused",
    remainingMs,
    targetAt: null,
  };
  saveActive();
  render();
}

function finishToday() {
  if (!window.confirm("确定结束今天的计时吗？已有计划和记录会保留。")) return;
  active = createIdleActive();
  saveActive();
  render();
}

function addPlan(event) {
  event.preventDefault();
  const text = planInputEl.value.trim();
  if (!text) return;
  const day = getToday();
  day.plans.push({
    id: createId("plan"),
    text,
    done: false,
    createdAt: new Date().toISOString(),
  });
  planInputEl.value = "";
  saveDays();
  render();
}

function addLog(event) {
  event.preventDefault();
  saveLogFromFields(workInputEl, progressInputEl, planSelectEl);
}

function addModalLog(event) {
  event.preventDefault();
  saveLogFromFields(modalWorkInputEl, modalProgressInputEl, modalPlanSelectEl);
}

function saveLogFromFields(workEl, progressEl, planEl) {
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

  const now = new Date();
  const endedAt = active.state === "pending" && active.pendingEndedAt
    ? active.pendingEndedAt
    : now.toISOString();
  const startedAt = active.state === "pending" && active.pendingStartedAt
    ? active.pendingStartedAt
    : new Date(now.getTime() - settings.intervalMinutes * 60 * 1000).toISOString();

  const day = getToday();
  day.logs.push({
    id: createId("log"),
    startedAt,
    endedAt,
    work,
    progress,
    text: `${work}｜${progress}`,
    planId: planEl.value || "",
  });

  active = {
    ...createIdleActive(),
    round: day.logs.length + 1,
  };
  workInputEl.value = "";
  progressInputEl.value = "";
  modalWorkInputEl.value = "";
  modalProgressInputEl.value = "";
  hideReminderModal();
  saveDays();
  saveActive();
  startOrResume();
}

function checkTimer() {
  normalizeActive();
  if (active.state !== "running" || !active.targetAt) {
    render();
    return;
  }

  if (Date.now() < new Date(active.targetAt).getTime()) {
    renderTimerOnly();
    return;
  }

  active = {
    ...active,
    state: "pending",
    pendingStartedAt: active.startedAt || new Date(Date.now() - settings.intervalMinutes * 60 * 1000).toISOString(),
    pendingEndedAt: active.targetAt,
    targetAt: null,
    remainingMs: null,
  };
  saveActive();
  startReminderSound();
  showNotification();
  showReminderModal();
  document.title = "该记录了 - 15分钟计划记录";
  render();
  setTimeout(() => modalWorkInputEl.focus(), 50);
}

function startTicker() {
  if (ticker) window.clearInterval(ticker);
  ticker = window.setInterval(checkTimer, 1000);
}

function render() {
  ensureToday();
  renderHeader();
  renderTimerOnly();
  renderPlans();
  renderPlanSelect();
  renderModalPlanSelect();
  renderTimeline();
  renderHistoryDate();
  renderHistory();
  renderReminderModal();
}

function renderHeader() {
  const today = new Date();
  todayLabelEl.textContent = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const statusMap = {
    idle: "未开始",
    running: "计时中",
    paused: "已暂停",
    pending: "待记录",
  };
  statusTextEl.textContent = statusMap[active.state] || "未开始";
  document.title = active.state === "pending" ? "该记录了 - 15分钟计划记录" : "15分钟计划记录";

  if (active.state === "running" && active.targetAt) {
    nextReminderTextEl.textContent = `下次提醒 ${formatClock(active.targetAt)}`;
  } else if (active.state === "pending") {
    nextReminderTextEl.textContent = "请先保存本轮记录";
  } else if (active.state === "paused") {
    nextReminderTextEl.textContent = "计时已暂停";
  } else {
    nextReminderTextEl.textContent = "等待开始";
  }
}

function renderTimerOnly() {
  let remainingMs = settings.intervalMinutes * 60 * 1000;
  let progress = 0;

  if (active.state === "running" && active.targetAt) {
    remainingMs = Math.max(0, new Date(active.targetAt).getTime() - Date.now());
    const totalMs = settings.intervalMinutes * 60 * 1000;
    progress = 1 - remainingMs / totalMs;
  } else if (active.state === "paused" && active.remainingMs) {
    remainingMs = active.remainingMs;
    progress = 1 - remainingMs / (settings.intervalMinutes * 60 * 1000);
  } else if (active.state === "pending") {
    remainingMs = 0;
    progress = 1;
  }

  timerTextEl.textContent = formatDuration(remainingMs);
  roundTextEl.textContent = `第 ${active.round || getToday().logs.length + 1 || 1} 轮`;
  progressCircleEl.style.strokeDashoffset = String(CIRCLE_LENGTH * (1 - Math.min(1, Math.max(0, progress))));
  pendingBoxEl.hidden = active.state !== "pending";

  startButtonEl.textContent = active.state === "paused" ? "继续" : active.state === "pending" ? "去记录" : "开始";
  pauseButtonEl.disabled = active.state !== "running";
}

function renderPlans() {
  const plans = getToday().plans;
  if (plans.length === 0) {
    planListEl.innerHTML = '<li class="empty">今天还没有计划</li>';
    return;
  }

  planListEl.replaceChildren(
    ...plans.map((plan) => {
      const item = document.createElement("li");
      item.className = `plan-item${plan.done ? " done" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = plan.done;
      checkbox.addEventListener("change", () => {
        plan.done = checkbox.checked;
        saveDays();
        render();
      });

      const text = document.createElement("div");
      text.className = "plan-text";
      text.textContent = plan.text;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `删除计划：${plan.text}`);
      remove.addEventListener("click", () => {
        const day = getToday();
        day.plans = day.plans.filter((itemPlan) => itemPlan.id !== plan.id);
        day.logs.forEach((log) => {
          if (log.planId === plan.id) log.planId = "";
        });
        saveDays();
        render();
      });

      item.append(checkbox, text, remove);
      return item;
    }),
  );
}

function renderPlanSelect() {
  const plans = getToday().plans;
  const currentValue = planSelectEl.value;
  planSelectEl.replaceChildren(
    createOption("", "不关联计划"),
    ...plans.map((plan) => createOption(plan.id, plan.done ? `已完成：${plan.text}` : plan.text)),
  );
  if (plans.some((plan) => plan.id === currentValue)) {
    planSelectEl.value = currentValue;
  }
}

function renderModalPlanSelect() {
  const plans = getToday().plans;
  const currentValue = modalPlanSelectEl.value;
  modalPlanSelectEl.replaceChildren(
    createOption("", "不关联计划"),
    ...plans.map((plan) => createOption(plan.id, plan.done ? `已完成：${plan.text}` : plan.text)),
  );
  if (plans.some((plan) => plan.id === currentValue)) {
    modalPlanSelectEl.value = currentValue;
  }
}

function renderReminderModal() {
  if (active.state === "pending") {
    reminderModalEl.hidden = false;
    document.body.classList.add("has-reminder-modal");
  } else {
    hideReminderModal();
  }
}

function showReminderModal() {
  reminderModalEl.hidden = false;
  document.body.classList.add("has-reminder-modal");
  startReminderSound();
}

function hideReminderModal() {
  reminderModalEl.hidden = true;
  document.body.classList.remove("has-reminder-modal");
  stopReminderSound();
}

function renderTimeline() {
  const day = getToday();
  timelineHintEl.textContent = day.logs.length
    ? `今天已经记录 ${day.logs.length} 次。`
    : "每条记录包含工作内容和进度。";

  if (day.logs.length === 0) {
    timelineListEl.innerHTML = '<li class="empty">暂无记录</li>';
    return;
  }

  const planById = new Map(day.plans.map((plan) => [plan.id, plan]));
  timelineListEl.replaceChildren(
    ...[...day.logs].reverse().map((log) => {
      const item = document.createElement("li");
      item.className = "timeline-item";
      const plan = planById.get(log.planId);
      const work = log.work || log.text || "";
      const progress = log.progress || "";
      item.innerHTML = `
        <div class="timeline-time">${escapeHtml(formatClock(log.startedAt))} - ${escapeHtml(formatClock(log.endedAt))}</div>
        <div class="timeline-body">
          <strong>${escapeHtml(work)}</strong>
          ${progress ? `<p>${escapeHtml(progress)}</p>` : ""}
          ${plan ? `<span>${escapeHtml(plan.text)}</span>` : ""}
        </div>
      `;
      return item;
    }),
  );
}

function renderHistoryDate() {
  if (!historyDateEl.value) historyDateEl.value = getDateKey();
}

function renderHistory() {
  const dateKey = historyDateEl.value || getDateKey();
  const day = days[dateKey];
  if (!day) {
    historyViewEl.innerHTML = '<div class="empty">这一天没有记录</div>';
    return;
  }

  const planById = new Map(day.plans.map((plan) => [plan.id, plan]));
  const plans = day.plans.length
    ? day.plans.map((plan) => `<li>${plan.done ? "✓ " : ""}${escapeHtml(plan.text)}</li>`).join("")
    : "<li>没有计划</li>";
  const logs = day.logs.length
    ? day.logs
        .map((log) => {
          const plan = planById.get(log.planId);
          const work = log.work || log.text || "";
          const progress = log.progress || "";
          return `<li><strong>${escapeHtml(formatClock(log.startedAt))}</strong> ${escapeHtml(work)}${progress ? `：${escapeHtml(progress)}` : ""}${plan ? ` <em>(${escapeHtml(plan.text)})</em>` : ""}</li>`;
        })
        .join("")
    : "<li>没有记录</li>";

  historyViewEl.innerHTML = `
    <div class="history-grid">
      <div class="history-card">
        <h3>计划</h3>
        <ul>${plans}</ul>
      </div>
      <div class="history-card">
        <h3>记录</h3>
        <ol>${logs}</ol>
      </div>
    </div>
  `;
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    window.alert("当前浏览器不支持系统通知。");
    return;
  }
  const result = await Notification.requestPermission();
  notifyButtonEl.textContent = result === "granted" ? "通知已开启" : "开启通知";
}

function showNotification() {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("该记录了", {
      body: "请填写当前工作和进度。",
      tag: "ykc-focus-reminder",
    });
  }
}

function playReminderSound() {
  if (!settings.soundEnabled) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.42);
  } catch {
    // Audio feedback is best-effort only.
  }
}

function startReminderSound() {
  playReminderSound();
  if (reminderSoundTimer) return;
  reminderSoundTimer = window.setInterval(playReminderSound, 3500);
}

function stopReminderSound() {
  if (reminderSoundTimer) window.clearInterval(reminderSoundTimer);
  reminderSoundTimer = null;
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    settings,
    days,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `focus-records-${getDateKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || "{}"));
      if (data.settings && typeof data.settings === "object") {
        settings = { ...defaultSettings, ...data.settings };
      }
      if (data.days && typeof data.days === "object") {
        days = { ...days, ...data.days };
      }
      saveSettings();
      saveDays();
      ensureToday();
      render();
      window.alert("导入完成。");
    } catch {
      window.alert("导入失败：文件不是有效 JSON。");
    } finally {
      importFileEl.value = "";
    }
  };
  reader.readAsText(file);
}

function clearData() {
  if (!window.confirm("确定清空所有本地计划和记录吗？此操作不能恢复。")) return;
  if (!window.confirm("再次确认：只会清空当前浏览器里的本地数据。")) return;
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(DAYS_KEY);
  localStorage.removeItem(ACTIVE_KEY);
  settings = { ...defaultSettings };
  days = {};
  active = createIdleActive();
  ensureToday();
  render();
}

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : structuredCloneSafe(fallback);
  } catch {
    return structuredCloneSafe(fallback);
  }
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function saveDays() {
  localStorage.setItem(DAYS_KEY, JSON.stringify(days));
}

function saveActive() {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
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

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
