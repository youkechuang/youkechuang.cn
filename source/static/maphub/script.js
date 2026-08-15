const STORAGE_PREFIX = "province-leaflet-map";
const LEVEL_SIZE = 10;

const regionMetadata = [
  ["110000", "beijing", "北京", "北京市", "直辖市", "北京", "华北", "#c9ddcf"],
  ["120000", "tianjin", "天津", "天津市", "直辖市", "天津", "华北", "#d9e4c7"],
  ["130000", "hebei", "河北", "河北省", "省", "石家庄", "华北", "#d7c9a8"],
  ["140000", "shanxi", "山西", "山西省", "省", "太原", "华北", "#c8d5b9"],
  ["150000", "neimenggu", "内蒙古", "内蒙古自治区", "自治区", "呼和浩特", "华北", "#c8d7d8"],
  ["210000", "liaoning", "辽宁", "辽宁省", "省", "沈阳", "东北", "#b8d3d1"],
  ["220000", "jilin", "吉林", "吉林省", "省", "长春", "东北", "#c8dcbf"],
  ["230000", "heilongjiang", "黑龙江", "黑龙江省", "省", "哈尔滨", "东北", "#b5cad7"],
  ["310000", "shanghai", "上海", "上海市", "直辖市", "上海", "华东", "#d8c7b4"],
  ["320000", "jiangsu", "江苏", "江苏省", "省", "南京", "华东", "#b9d7cf"],
  ["330000", "zhejiang", "浙江", "浙江省", "省", "杭州", "华东", "#b9d8bb"],
  ["340000", "anhui", "安徽", "安徽省", "省", "合肥", "华东", "#c8d0bc"],
  ["350000", "fujian", "福建", "福建省", "省", "福州", "华东", "#d7c996"],
  ["360000", "jiangxi", "江西", "江西省", "省", "南昌", "华东", "#c4d8b5"],
  ["370000", "shandong", "山东", "山东省", "省", "济南", "华东", "#b8d2bf"],
  ["410000", "henan", "河南", "河南省", "省", "郑州", "华中", "#d7c189"],
  ["420000", "hubei", "湖北", "湖北省", "省", "武汉", "华中", "#b9d4d9"],
  ["430000", "hunan", "湖南", "湖南省", "省", "长沙", "华中", "#d7c7b5"],
  ["440000", "guangdong", "广东", "广东省", "省", "广州", "华南", "#d6bda8"],
  ["450000", "guangxi", "广西", "广西壮族自治区", "自治区", "南宁", "华南", "#b8d2d8"],
  ["460000", "hainan", "海南", "海南省", "省", "海口", "华南", "#d9c99e"],
  ["500000", "chongqing", "重庆", "重庆市", "直辖市", "重庆", "西南", "#d5b79e"],
  ["510000", "sichuan", "四川", "四川省", "省", "成都", "西南", "#b8d8d3"],
  ["520000", "guizhou", "贵州", "贵州省", "省", "贵阳", "西南", "#c2d8be"],
  ["530000", "yunnan", "云南", "云南省", "省", "昆明", "西南", "#bfd7a8"],
  ["540000", "xizang", "西藏", "西藏自治区", "自治区", "拉萨", "西南", "#b8d1bd"],
  ["610000", "shaanxi", "陕西", "陕西省", "省", "西安", "西北", "#cdd8a9"],
  ["620000", "gansu", "甘肃", "甘肃省", "省", "兰州", "西北", "#d8c083"],
  ["630000", "qinghai", "青海", "青海省", "省", "西宁", "西北", "#a9ccd7"],
  ["640000", "ningxia", "宁夏", "宁夏回族自治区", "自治区", "银川", "西北", "#d7b98c"],
  ["650000", "xinjiang", "新疆", "新疆维吾尔自治区", "自治区", "乌鲁木齐", "西北", "#9fc9d6"],
  ["710000", "taiwan", "台湾", "台湾省", "省", "台北", "华东", "#a9d2d1"],
  ["810000", "hongkong", "香港", "香港特别行政区", "特别行政区", "香港", "华南", "#d6b9bd"],
  ["820000", "macau", "澳门", "澳门特别行政区", "特别行政区", "澳门", "华南", "#d5bdca"],
];

const chinaRegions = regionMetadata.map(
  ([adcode, id, name, fullName, type, capital, zone, color]) => ({
    adcode,
    id,
    name,
    fullName,
    type,
    capital,
    zone,
    color,
  }),
);

const worldRegions = (window.WORLD_GEOJSON?.features || []).map((feature) => ({ ...feature.properties }));
const datasets = {
  china: {
    key: "china",
    title: "省份真实地图",
    subtitle: "先学习，再挑战。用真实省级边界记住位置、省会和区域。",
    rangeLabel: "省级区域",
    listLabel: "省份列表",
    targetPrefix: "找到",
    center: [35.5, 104],
    minZoom: 3,
    maxZoom: 8,
    initialZoom: window.innerWidth <= 720 ? 3.25 : 4,
    maxAnswerZoom: 5.5,
    geoData: window.CHINA_GEOJSON,
    regions: chinaRegions,
  },
  world: {
    key: "world",
    title: "世界国家地图",
    subtitle: "按洲预习世界各国位置，点击国家查看中文名、英文名、所属地区和首都。",
    rangeLabel: "国家/地区",
    listLabel: "国家列表",
    targetPrefix: "找到",
    center: [20, 20],
    minZoom: 1,
    maxZoom: 7,
    initialZoom: window.innerWidth <= 720 ? 1.15 : 1.65,
    maxAnswerZoom: 4.8,
    geoData: window.WORLD_GEOJSON,
    regions: worldRegions,
  },
};

let activeDatasetKey = "china";
let activeDataset = datasets.china;
let regions = [];
let regionById = new Map();
let regionByAdcode = new Map();
let found = new Set();
let wrongIds = new Set();
let zones = [];
let activeId = null;
let challengeId = null;
let revealedAnswerId = null;
let appMode = "study";
let studyZone = "全部";
let levelZone = "全部";
let showStudyLabels = false;
let isStudyListOpen = false;
let recent = [];
let level = createEmptyLevel();
let timerId = null;
let map = null;
let magnifierMap = null;
let magnifierLayer = null;
let isPseudoFullscreen = false;
let provinceLayer = null;
let labelLayer = null;
let isMagnifierEnabled = false;
const provinceLayers = new Map();
const labelMarkers = new Map();

const mapEl = document.querySelector("#map");
const mapPanelEl = document.querySelector("#mapPanel");
const fullscreenButtonEl = document.querySelector("#fullscreenButton");
const magnifierButtonEl = document.querySelector("#magnifierButton");
const mapMagnifierEl = document.querySelector("#mapMagnifier");
const magnifierMapEl = document.querySelector("#magnifierMap");
const foundCountEl = document.querySelector("#foundCount");
const completionRateEl = document.querySelector("#completionRate");
const provinceNameEl = document.querySelector("#provinceName");
const provinceTypeEl = document.querySelector("#provinceType");
const provinceZoneEl = document.querySelector("#provinceZone");
const capitalLabelEl = document.querySelector("#capitalLabel");
const provinceCapitalEl = document.querySelector("#provinceCapital");
const challengeTargetEl = document.querySelector("#challengeTarget");
const challengeFeedbackEl = document.querySelector("#challengeFeedback");
const challengeButtonEl = document.querySelector("#challengeButton");
const dailyButtonEl = document.querySelector("#dailyButton");
const wrongButtonEl = document.querySelector("#wrongButton");
const answerButtonEl = document.querySelector("#answerButton");
const resetButtonEl = document.querySelector("#resetButton");
const recentListEl = document.querySelector("#recentList");
const levelProgressEl = document.querySelector("#levelProgress");
const levelScoreEl = document.querySelector("#levelScore");
const levelStreakEl = document.querySelector("#levelStreak");
const levelTimerEl = document.querySelector("#levelTimer");
const levelResultEl = document.querySelector("#levelResult");
const levelZoneButtonsEl = document.querySelector("#levelZoneButtons");
const studyZoneSelectEl = document.querySelector("#studyZoneSelect");
const studyLabelToggleEl = document.querySelector("#studyLabelToggle");
const studyListEl = document.querySelector("#studyList");
const studyListPanelEl = document.querySelector("#studyListPanel");
const studyListTitleEl = document.querySelector("#studyListTitle");
const studyListToggleEl = document.querySelector("#studyListToggle");
const studyCurrentNameEl = document.querySelector("#studyCurrentName");
const studyCurrentMetaEl = document.querySelector("#studyCurrentMeta");
const studyCurrentHintEl = document.querySelector("#studyCurrentHint");
const studyPrevButtonEl = document.querySelector("#studyPrevButton");
const studyNextButtonEl = document.querySelector("#studyNextButton");
const studyStartZoneButtonEl = document.querySelector("#studyStartZoneButton");
const studyModeButtonEl = document.querySelector("#studyModeButton");
const levelModeButtonEl = document.querySelector("#levelModeButton");
const chinaScopeButtonEl = document.querySelector("#chinaScopeButton");
const worldScopeButtonEl = document.querySelector("#worldScopeButton");
const mapTitleEl = document.querySelector("#mapTitle");
const mapSubtitleEl = document.querySelector("#mapSubtitle");

activateDataset("china");

challengeButtonEl.addEventListener("click", startChallenge);
dailyButtonEl.addEventListener("click", startDailyChallenge);
wrongButtonEl.addEventListener("click", startWrongReview);
answerButtonEl.addEventListener("click", revealAnswer);
resetButtonEl.addEventListener("click", resetGame);
fullscreenButtonEl.addEventListener("click", toggleFullscreen);
magnifierButtonEl.addEventListener("click", toggleMagnifier);
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isPseudoFullscreen) exitPseudoFullscreen();
});
studyLabelToggleEl.addEventListener("change", () => {
  showStudyLabels = studyLabelToggleEl.checked;
  updateMapState();
});
studyPrevButtonEl.addEventListener("click", () => selectStudySibling(-1));
studyNextButtonEl.addEventListener("click", () => selectStudySibling(1));
studyStartZoneButtonEl.addEventListener("click", () => startZoneChallenge(studyZone));
studyZoneSelectEl.addEventListener("change", () => {
  studyZone = studyZoneSelectEl.value;
  const first = getRegionsInZone(studyZone)[0];
  if (first) selectStudyRegion(first.id, { fitBounds: false });
  updateUi();
});
studyListToggleEl.addEventListener("click", () => {
  isStudyListOpen = !isStudyListOpen;
  renderStudyList();
});
studyModeButtonEl.addEventListener("click", () => setMode("study"));
levelModeButtonEl.addEventListener("click", () => setMode("level"));
chinaScopeButtonEl.addEventListener("click", () => activateDataset("china"));
worldScopeButtonEl.addEventListener("click", () => activateDataset("world"));

function activateDataset(key) {
  const nextDataset = datasets[key];
  if (!nextDataset?.geoData?.features?.length) {
    challengeFeedbackEl.textContent = "地图数据加载失败";
    challengeFeedbackEl.className = "feedback warn";
    return;
  }

  activeDatasetKey = key;
  activeDataset = nextDataset;
  regions = activeDataset.regions;
  regionById = new Map(regions.map((region) => [region.id, region]));
  regionByAdcode = new Map(regions.map((region) => [region.adcode, region]));
  found = new Set(loadFound());
  wrongIds = new Set(loadWrongIds());
  zones = ["全部", ...Array.from(new Set(regions.map((region) => region.zone)))];
  activeId = null;
  challengeId = null;
  revealedAnswerId = null;
  studyZone = "全部";
  levelZone = "全部";
  recent = [];
  level = createEmptyLevel();
  stopTimer();

  mapTitleEl.textContent = activeDataset.title;
  mapSubtitleEl.textContent = activeDataset.subtitle;
  chinaScopeButtonEl.classList.toggle("active", key === "china");
  worldScopeButtonEl.classList.toggle("active", key === "world");
  provinceLayers.clear();
  labelMarkers.clear();
  if (labelLayer) labelLayer.clearLayers();
  destroyMagnifierMap();
  if (map) {
    map.remove();
    map = null;
  }

  challengeButtonEl.textContent = "开始闯关";
  challengeTargetEl.textContent = "未开始";
  challengeFeedbackEl.textContent = " ";
  challengeFeedbackEl.className = "feedback";
  levelResultEl.textContent = "完成一局后显示成绩";
  levelResultEl.className = "level-result";
  renderMap();
  setMode("study", { keepState: true });
}

function createEmptyLevel() {
  return {
    active: false,
    locked: false,
    mode: "standard",
    questions: [],
    index: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correct: 0,
    mistakes: 0,
    startedAt: null,
    elapsedSeconds: 0,
  };
}

function loadFound() {
  try {
    const stored = JSON.parse(localStorage.getItem(getStorageKey("discovered")) || "[]");
    return Array.isArray(stored)
      ? stored.filter((id) => regionById.has(id))
      : [];
  } catch {
    return [];
  }
}

function loadWrongIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(getStorageKey("wrong")) || "[]");
    return Array.isArray(stored)
      ? stored.filter((id) => regionById.has(id))
      : [];
  } catch {
    return [];
  }
}

function saveFound() {
  localStorage.setItem(getStorageKey("discovered"), JSON.stringify([...found]));
}

function saveWrongIds() {
  localStorage.setItem(getStorageKey("wrong"), JSON.stringify([...wrongIds]));
}

function getStorageKey(name) {
  return `${STORAGE_PREFIX}.${activeDatasetKey}.${name}.v1`;
}

function renderMap() {
  const geoData = activeDataset.geoData;
  if (!window.L || !geoData?.features?.length) {
    mapEl.textContent = "地图数据加载失败";
    return;
  }

  map = L.map(mapEl, {
    attributionControl: false,
    center: activeDataset.center,
    maxZoom: activeDataset.maxZoom,
    minZoom: activeDataset.minZoom,
    preferCanvas: false,
    scrollWheelZoom: true,
    touchZoom: true,
    zoomControl: true,
    zoom: activeDataset.initialZoom,
    zoomSnap: 0.25,
  });

  const namedFeatures = geoData.features.filter((feature) => feature.properties?.name);
  const decorationFeatures = geoData.features.filter((feature) => !feature.properties?.name);

  L.geoJSON(
    {
      type: "FeatureCollection",
      features: decorationFeatures,
    },
    {
      interactive: false,
      style: {
        color: "rgba(24, 32, 44, 0.32)",
        fillOpacity: 0,
        weight: 1,
      },
    },
  ).addTo(map);

  provinceLayer = L.geoJSON(
    {
      type: "FeatureCollection",
      features: namedFeatures,
    },
    {
      style: (feature) => getProvinceStyle(getRegionByFeature(feature)),
      onEachFeature,
    },
  ).addTo(map);

  labelLayer = L.layerGroup().addTo(map);
  const bounds = provinceLayer.getBounds();
  map.fitBounds(bounds, { padding: window.innerWidth <= 720 ? [8, 8] : [18, 18] });
  map.setMaxBounds(bounds.pad(0.18));
  map.on("mousemove", updateMagnifierPosition);
  map.on("mouseout", hideMagnifier);
  map.on("touchmove", updateMagnifierPosition);
  map.on("touchend", hideMagnifier);
  mapEl.addEventListener("pointermove", updateMagnifierFromPointer, { passive: true });
  mapEl.addEventListener("pointerleave", hideMagnifier);
  mapEl.addEventListener("touchstart", updateMagnifierFromTouch, { passive: true });
  mapEl.addEventListener("touchmove", updateMagnifierFromTouch, { passive: true });
  setTimeout(() => map.invalidateSize(), 0);
}

function onEachFeature(feature, layer) {
  const region = getRegionByFeature(feature);
  if (!region) return;

  provinceLayers.set(region.id, layer);
  layer.on({
    click: () => selectRegion(region.id),
    mouseover: () => {
      layer.setStyle(getHoverStyle(region));
      layer.bringToFront();
    },
    mouseout: () => updateMapState(),
    add: () => {
      const element = layer.getElement();
      if (!element) return;
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");
      element.setAttribute("aria-label", region.fullName);
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectRegion(region.id);
        }
      });
    },
  });

  addLabelMarker(region, feature);
  addSmallRegionHitArea(region, feature);
}

function addLabelMarker(region, feature) {
  const point = feature.properties?.centroid || feature.properties?.center;
  if (!point) return;

  const marker = L.marker(toLatLng(point), {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className: "province-label-icon",
      html: `<span>${region.name}</span>`,
      iconAnchor: [0, 0],
    }),
    zIndexOffset: 1000,
  });
  labelMarkers.set(region.id, marker);
}

function addSmallRegionHitArea(region, feature) {
  const point = feature.properties?.centroid || feature.properties?.center;
  if (activeDatasetKey === "world" && point) {
    L.circleMarker(toLatLng(point), {
      bubblingMouseEvents: false,
      color: "transparent",
      fillColor: "transparent",
      fillOpacity: 0,
      interactive: true,
      opacity: 0,
      radius: window.innerWidth <= 720 ? 12 : 8,
      weight: 0,
    })
      .on("click", () => selectRegion(region.id))
      .addTo(map);
    return;
  }

  const radius = {
    beijing: 13,
    tianjin: 13,
    shanghai: 13,
    hongkong: 15,
    macau: 18,
  }[region.id];
  if (!radius || !point) return;

  L.circleMarker(toLatLng(point), {
    bubblingMouseEvents: false,
    color: "transparent",
    fillColor: "transparent",
    fillOpacity: 0,
    interactive: true,
    opacity: 0,
    radius,
    weight: 0,
  })
    .on("click", () => selectRegion(region.id))
    .addTo(map);
}

function getRegionByFeature(feature) {
  if (feature.properties?.id) return regionById.get(String(feature.properties.id));
  return regionByAdcode.get(String(feature.properties?.adcode || ""));
}

async function toggleFullscreen() {
  if (isPseudoFullscreen) {
    exitPseudoFullscreen();
    return;
  }

  if (!document.fullscreenElement) {
    try {
      if (!mapPanelEl.requestFullscreen) throw new Error("Fullscreen API unavailable");
      await mapPanelEl.requestFullscreen();
    } catch {
      enterPseudoFullscreen();
    }
  } else {
    await document.exitFullscreen();
  }
  setTimeout(() => map?.invalidateSize(), 180);
}

function updateFullscreenButton() {
  const active = document.fullscreenElement === mapPanelEl || isPseudoFullscreen;
  fullscreenButtonEl.textContent = active ? "退出全屏" : "全屏";
  mapPanelEl.classList.toggle("is-fullscreen", active);
  document.body.classList.toggle("map-fullscreen-open", active);
  setTimeout(() => {
    map?.invalidateSize();
    magnifierMap?.invalidateSize();
  }, 180);
}

function enterPseudoFullscreen() {
  isPseudoFullscreen = true;
  updateFullscreenButton();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function exitPseudoFullscreen() {
  isPseudoFullscreen = false;
  updateFullscreenButton();
}

function toggleMagnifier() {
  isMagnifierEnabled = !isMagnifierEnabled;
  magnifierButtonEl.classList.toggle("active", isMagnifierEnabled);
  magnifierButtonEl.textContent = isMagnifierEnabled ? "关闭放大镜" : "放大镜";
  if (isMagnifierEnabled) {
    ensureMagnifierMap();
    challengeFeedbackEl.textContent = "放大镜已打开，手指在地图上移动即可查看局部放大";
    challengeFeedbackEl.className = "feedback";
  } else {
    hideMagnifier();
  }
}

function ensureMagnifierMap() {
  if (magnifierMap) return;
  magnifierMap = L.map(magnifierMapEl, {
    attributionControl: false,
    dragging: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    scrollWheelZoom: false,
    touchZoom: false,
    zoomControl: false,
    zoomSnap: 0.25,
  });
  magnifierLayer = L.geoJSON(activeDataset.geoData, {
    interactive: false,
    style: (feature) => getProvinceStyle(getRegionByFeature(feature)),
  }).addTo(magnifierMap);
}

function destroyMagnifierMap() {
  if (magnifierMap) {
    magnifierMap.remove();
    magnifierMap = null;
    magnifierLayer = null;
  }
  hideMagnifier();
}

function updateMagnifierPosition(event) {
  if (!isMagnifierEnabled || !event.latlng) return;
  const point = map.latLngToContainerPoint(event.latlng);
  renderMagnifier(point, event.latlng);
}

function updateMagnifierFromPointer(event) {
  if (!isMagnifierEnabled || !map) return;
  const rect = mapEl.getBoundingClientRect();
  const point = L.point(event.clientX - rect.left, event.clientY - rect.top);
  renderMagnifier(point, map.containerPointToLatLng(point));
}

function updateMagnifierFromTouch(event) {
  if (!isMagnifierEnabled || !map || !event.touches?.length) return;
  const touch = event.touches[0];
  const rect = mapEl.getBoundingClientRect();
  const point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
  renderMagnifier(point, map.containerPointToLatLng(point));
}

function renderMagnifier(point, latlng) {
  ensureMagnifierMap();
  const size = window.innerWidth <= 720 ? 132 : 168;
  const offsetX = point.x > mapEl.clientWidth - size - 18 ? -size - 18 : 18;
  const offsetY = point.y > mapEl.clientHeight - size - 18 ? -size - 18 : 18;
  mapMagnifierEl.style.setProperty("--lens-size", `${size}px`);
  mapMagnifierEl.style.transform = `translate(${point.x + offsetX}px, ${point.y + offsetY}px)`;
  mapMagnifierEl.hidden = false;
  const targetZoom = Math.min(activeDataset.maxZoom, map.getZoom() + (window.innerWidth <= 720 ? 2.4 : 2));
  magnifierMap.setView(latlng, targetZoom, { animate: false });
  magnifierMap.invalidateSize();
}

function hideMagnifier() {
  mapMagnifierEl.hidden = true;
}

function toLatLng([lng, lat]) {
  return [lat, lng];
}

function getProvinceStyle(region) {
  const isActive = region.id === activeId;
  const isTarget = region.id === challengeId;
  const isFound = found.has(region.id);
  const isRevealed = region.id === revealedAnswerId;
  const isOutOfStudyZone = appMode === "study" && studyZone !== "全部" && region.zone !== studyZone;

  return {
    className: "province-shape",
    color: isRevealed ? "#dc2626" : isActive ? "#111827" : "rgba(24, 32, 44, 0.52)",
    dashArray: isTarget ? "7 5" : null,
    fillColor: region.color,
    fillOpacity: isRevealed ? 1 : isActive ? 0.98 : isOutOfStudyZone ? 0.28 : isFound ? 0.9 : 0.62,
    lineCap: "round",
    lineJoin: "round",
    opacity: isOutOfStudyZone ? 0.72 : 1,
    weight: isRevealed ? 4 : isActive ? 2.8 : isTarget ? 2.2 : 1.3,
  };
}

function getHoverStyle(region) {
  const base = getProvinceStyle(region);
  return {
    ...base,
    color: "#111827",
    fillOpacity: Math.max(base.fillOpacity, 0.84),
    weight: Math.max(base.weight, 2.4),
  };
}

function selectRegion(id) {
  const region = regionById.get(id);
  if (!region) return;

  if (level.active && challengeId && id !== challengeId) {
    handleLevelAnswer(region);
    return;
  }

  const wasNew = !found.has(id);
  found.add(id);
  activeId = id;
  recent = [id, ...recent.filter((recentId) => recentId !== id)].slice(0, 5);

  if (level.active && challengeId) {
    handleLevelAnswer(region);
  } else if (wasNew && found.size === regions.length) {
    challengeFeedbackEl.textContent = "全部发现完成";
    challengeFeedbackEl.className = "feedback good";
  } else if (wasNew) {
    challengeFeedbackEl.textContent = `发现：${region.fullName}`;
    challengeFeedbackEl.className = "feedback good";
  } else {
    challengeFeedbackEl.textContent = `当前：${region.fullName}`;
    challengeFeedbackEl.className = "feedback";
  }

  saveFound();
  updateUi();
}

function startChallenge() {
  startZoneChallenge(levelZone);
}

function startZoneChallenge(zone) {
  const pool = getRegionsInZone(zone);
  startLevel({
    mode: "standard",
    questions: shuffle(pool).slice(0, Math.min(LEVEL_SIZE, pool.length)).map((region) => region.id),
    title: zone === "全部" ? "闯关" : `${zone}测试`,
  });
}

function startDailyChallenge() {
  const questions = seededShuffle(regions, getTodayKey()).slice(0, LEVEL_SIZE).map((region) => region.id);
  startLevel({
    mode: "daily",
    questions,
    title: "每日挑战",
  });
}

function startWrongReview() {
  const questions = [...wrongIds].filter((id) => regionById.has(id));
  if (questions.length === 0) {
    setMode("level", { keepState: true });
    challengeTargetEl.textContent = "暂无错题";
    challengeFeedbackEl.textContent = `答错或查看答案后，这里会自动收集需要复习的${activeDataset.rangeLabel}`;
    challengeFeedbackEl.className = "feedback";
    levelResultEl.textContent = "先完成一局挑战，再回来复习错题";
    levelResultEl.className = "level-result";
    updateLevelUi();
    return;
  }

  startLevel({
    mode: "review",
    questions: questions.slice(0, LEVEL_SIZE),
    title: "错题复习",
  });
}

function resetGame() {
  found.clear();
  activeId = null;
  challengeId = null;
  recent = [];
  challengeTargetEl.textContent = "未开始";
  challengeFeedbackEl.textContent = " ";
  challengeFeedbackEl.className = "feedback";
  revealedAnswerId = null;
  stopTimer();
  level = createEmptyLevel();
  levelResultEl.textContent = "完成一局后显示成绩";
  levelResultEl.className = "level-result";
  challengeButtonEl.textContent = "开始闯关";
  saveFound();
  updateUi();
}

function startLevel({ mode, questions, title }) {
  setMode("level", { keepState: true });
  stopTimer();
  revealedAnswerId = null;
  level = {
    ...createEmptyLevel(),
    active: true,
    mode,
    questions,
    startedAt: Date.now(),
  };
  challengeButtonEl.textContent = "重新开始";
  levelResultEl.textContent = `${title}进行中`;
  levelResultEl.className = "level-result";
  challengeFeedbackEl.textContent = "看目标，点击地图上的对应省份";
  challengeFeedbackEl.className = "feedback";
  startTimer();
  showCurrentQuestion();
}

function handleLevelAnswer(region) {
  if (level.locked) return;

  const target = regionById.get(challengeId);
  if (region.id === challengeId) {
    level.correct += 1;
    level.streak += 1;
    level.bestStreak = Math.max(level.bestStreak, level.streak);
    level.score += 100 + getStreakBonus(level.streak);
    if (level.mode === "review") {
      wrongIds.delete(region.id);
      saveWrongIds();
    }
    revealedAnswerId = null;
    challengeFeedbackEl.textContent = `正确：${region.fullName} +${100 + getStreakBonus(level.streak)}`;
    challengeFeedbackEl.className = "feedback good";
    level.index += 1;
    level.locked = true;
    updateLevelUi();

    if (level.index >= level.questions.length) {
      setTimeout(finishLevel, 450);
    } else {
      setTimeout(() => {
        level.locked = false;
        showCurrentQuestion();
      }, 520);
    }
    return;
  }

  level.mistakes += 1;
  level.streak = 0;
  level.score = Math.max(0, level.score - 20);
  wrongIds.add(target.id);
  saveWrongIds();
  challengeFeedbackEl.textContent = `点到的是${region.name}，目标是${target.name}，扣 20 分`;
  challengeFeedbackEl.className = "feedback warn";
  updateLevelUi();
}

function showCurrentQuestion() {
  const target = regionById.get(level.questions[level.index]);
  challengeId = target.id;
  revealedAnswerId = null;
  challengeTargetEl.textContent = `第 ${level.index + 1} 题：${activeDataset.targetPrefix} ${target.fullName}`;
  updateLevelUi();
  updateMapState();
}

function finishLevel() {
  stopTimer();
  level.active = false;
  level.locked = false;
  challengeId = null;
  revealedAnswerId = null;
  const timeBonus = Math.max(0, 180 - level.elapsedSeconds);
  level.score += timeBonus;
  const accuracy = Math.round((level.correct / level.questions.length) * 100);
  const stars = getStars(accuracy, level.mistakes, level.elapsedSeconds);
  const best = Math.max(Number(localStorage.getItem(getStorageKey("best")) || 0), level.score);
  localStorage.setItem(getStorageKey("best"), String(best));
  challengeTargetEl.textContent = "闯关完成";
  challengeFeedbackEl.textContent = `正确率 ${accuracy}% ｜ 用时 ${formatTime(level.elapsedSeconds)} ｜ 时间奖励 ${timeBonus}`;
  challengeFeedbackEl.className = "feedback good";
  const wrongText = wrongIds.size > 0 ? `，错题 ${wrongIds.size} 个` : "";
  levelResultEl.textContent = `${stars} ${level.score} 分，最高连击 ${level.bestStreak}，历史最佳 ${best} 分${wrongText}`;
  levelResultEl.className = stars.length >= 2 ? "level-result good" : "level-result warn";
  challengeButtonEl.textContent = "再来一局";
  updateLevelUi();
  updateMapState();
}

function setMode(mode, options = {}) {
  appMode = mode;
  document.body.classList.toggle("is-study-mode", mode === "study");
  document.body.classList.toggle("is-level-mode", mode === "level");
  studyModeButtonEl.classList.toggle("active", mode === "study");
  levelModeButtonEl.classList.toggle("active", mode === "level");

  if (mode === "study" && !options.keepState) {
    stopTimer();
    level = createEmptyLevel();
    challengeId = null;
    revealedAnswerId = null;
    challengeButtonEl.textContent = "开始闯关";
    challengeTargetEl.textContent = "未开始";
    challengeFeedbackEl.textContent = " ";
    challengeFeedbackEl.className = "feedback";
    levelResultEl.textContent = "完成一局后显示成绩";
    levelResultEl.className = "level-result";
  }

  updateUi();
}

function revealAnswer() {
  if (!level.active || !challengeId || level.locked) {
    challengeFeedbackEl.textContent = "开始闯关后，遇到不会的题可以查看答案";
    challengeFeedbackEl.className = "feedback";
    return;
  }

  const target = regionById.get(challengeId);
  revealedAnswerId = challengeId;
  level.mistakes += 1;
  level.streak = 0;
  level.score = Math.max(0, level.score - 50);
  wrongIds.add(target.id);
  saveWrongIds();
  challengeFeedbackEl.textContent = `答案：${target.fullName}，${getCapitalLabel()} ${target.capital}。本题扣 50 分，可以继续点击它进入下一题`;
  challengeFeedbackEl.className = "feedback warn";
  updateLevelUi();
  updateMapState();

  const layer = provinceLayers.get(challengeId);
  if (layer) {
    layer.bringToFront();
    try {
      map.fitBounds(layer.getBounds(), { maxZoom: activeDataset.maxAnswerZoom, padding: [28, 28] });
    } catch {
      // Ignore rare geometry bounds errors.
    }
  }
}

function getStreakBonus(streak) {
  if (streak >= 10) return 80;
  if (streak >= 5) return 40;
  if (streak >= 3) return 20;
  return 0;
}

function getStars(accuracy, mistakes, seconds) {
  if (accuracy === 100 && mistakes === 0 && seconds <= 90) return "★★★";
  if (accuracy >= 90 && mistakes <= 3) return "★★";
  return "★";
}

function startTimer() {
  updateTimer();
  timerId = window.setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (timerId) window.clearInterval(timerId);
  timerId = null;
}

function updateTimer() {
  if (!level.startedAt) return;
  level.elapsedSeconds = Math.floor((Date.now() - level.startedAt) / 1000);
  levelTimerEl.textContent = formatTime(level.elapsedSeconds);
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function seededShuffle(items, seedText) {
  const result = [...items];
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  const random = () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
}

function updateLevelUi() {
  const total = level.questions.length || LEVEL_SIZE;
  levelProgressEl.textContent = `${Math.min(level.index + (level.active ? 1 : 0), total)}/${total}`;
  levelScoreEl.textContent = String(level.score);
  levelStreakEl.textContent = String(level.streak);
  if (!level.startedAt) levelTimerEl.textContent = "00:00";
}

function updateUi() {
  const active = activeId ? regionById.get(activeId) : null;
  foundCountEl.textContent = `${found.size}/${regions.length}`;
  completionRateEl.textContent = `${Math.round((found.size / regions.length) * 100)}%`;

  provinceNameEl.textContent = active ? active.fullName : "尚未选择";
  provinceTypeEl.textContent = active ? active.type : "-";
  provinceZoneEl.textContent = active ? active.zone : "-";
  capitalLabelEl.textContent = getCapitalLabel();
  provinceCapitalEl.textContent = active ? active.capital : "-";

  renderRecent();
  renderStudyControls();
  renderStudyCurrent();
  updateLevelUi();
  updateMapState();
}

function updateMapState() {
  provinceLayers.forEach((layer, id) => {
    const region = regionById.get(id);
    layer.setStyle(getProvinceStyle(region));
    if (id === activeId) layer.bringToFront();
  });
  magnifierLayer?.setStyle((feature) => getProvinceStyle(getRegionByFeature(feature)));

  labelLayer.clearLayers();
  if (level.active) return;

  labelMarkers.forEach((marker, id) => {
    if (appMode === "study" ? showStudyLabels || id === activeId : found.has(id) || id === activeId) {
      marker.addTo(labelLayer);
    }
  });
}

function renderStudyControls() {
  studyZoneSelectEl.replaceChildren(
    ...zones.map((zone) => {
      const option = document.createElement("option");
      option.value = zone;
      option.textContent = zone === "全部" ? "学习范围：全部" : `学习范围：${zone}`;
      return option;
    }),
  );
  studyZoneSelectEl.value = studyZone;
  renderZoneButtons(levelZoneButtonsEl, levelZone, (zone) => {
    levelZone = zone;
    renderStudyControls();
  });
  renderStudyList();
}

function renderStudyList() {
  const pool = getRegionsInZone(studyZone);
  const items = pool.map((region) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "study-item";
    if (region.id === activeId) item.classList.add("active");
    item.textContent = region.name;
    item.addEventListener("click", () => selectStudyRegion(region.id));
    return item;
  });
  studyListEl.replaceChildren(...items);
  studyListPanelEl.hidden = !isStudyListOpen;
  studyListTitleEl.textContent = `${studyZone} · ${pool.length} 个${activeDataset.rangeLabel}`;
  studyListToggleEl.textContent = isStudyListOpen ? `收起 (${pool.length})` : `${activeDataset.listLabel} (${pool.length})`;
  studyStartZoneButtonEl.textContent = studyZone === "全部" ? "测试全部" : `测${studyZone}`;
}

function selectStudyRegion(id, options = {}) {
  setMode("study", { keepState: true });
  selectRegion(id);
  const layer = provinceLayers.get(id);
  if (layer && options.fitBounds !== false) {
    layer.bringToFront();
    try {
      map.fitBounds(layer.getBounds(), { maxZoom: activeDataset.maxAnswerZoom, padding: [28, 28] });
    } catch {
      // Ignore rare geometry bounds errors.
    }
  }
  renderStudyList();
}

function renderZoneButtons(container, activeZone, onSelect) {
  const buttons = zones.map((zone) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = zone;
    if (zone === activeZone) button.classList.add("active");
    button.addEventListener("click", () => onSelect(zone));
    return button;
  });
  container.replaceChildren(...buttons);
}

function getRegionsInZone(zone) {
  return regions.filter((region) => zone === "全部" || region.zone === zone);
}

function renderStudyCurrent() {
  const active = activeId ? regionById.get(activeId) : null;
  if (!active) {
    studyCurrentNameEl.textContent = "点击地图开始预习";
    studyCurrentMetaEl.textContent = `选择${activeDataset.rangeLabel}后显示区域、类型和${getCapitalLabel()}。`;
    studyCurrentHintEl.textContent = "隐藏名称观察形状，打开名称用于对照。";
    return;
  }

  studyCurrentNameEl.textContent = active.fullName;
  const englishName = active.englishName ? ` · ${active.englishName}` : "";
  const subregion = active.subregion ? ` · ${active.subregion}` : "";
  studyCurrentMetaEl.textContent = `${active.type}${englishName} · ${active.zone}${subregion} · ${getCapitalLabel()}：${active.capital}`;
  studyCurrentHintEl.textContent = getStudyHint(active);
}

function getStudyHint(region) {
  if (activeDatasetKey === "world") {
    const hints = {
      亚洲: "亚洲国家数量多，先按东亚、东南亚、南亚、中亚、西亚分块记。",
      欧洲: "欧洲国家密集，建议先记大国和半岛，再处理小国。",
      非洲: "非洲可先按北非、西非、中非、东非、南非分区建立轮廓。",
      北美洲: "北美洲先抓加拿大、美国、墨西哥，再补中美洲和加勒比地区。",
      南美洲: "南美洲沿安第斯山脉和大西洋海岸两条线记忆更稳定。",
      大洋洲: "大洋洲先记澳大利亚、新西兰，再看太平洋岛国。",
      南极洲: "南极洲面积大但国家学习权重低，可作为认识地理轮廓的补充。",
    };
    return hints[region.zone] || "先记它所属的大洲，再观察周边相邻国家。";
  }

  const hints = {
    华北: "先记北京、天津两个直辖市，再看河北、山西和内蒙古的位置关系。",
    东北: "东北三省从南到北依次是辽宁、吉林、黑龙江。",
    华东: "华东省份较多，建议沿海从山东、江苏、上海、浙江、福建一路向南记。",
    华中: "华中可围绕河南、湖北、湖南三省的南北位置来记。",
    华南: "华南重点看广东、广西、海南以及香港、澳门的位置。",
    西南: "西南面积和地形跨度大，先抓四川、重庆、云南、贵州、西藏。",
    西北: "西北从东向西看陕西、甘肃、青海、宁夏、新疆。",
  };
  return hints[region.zone] || "观察它在地图上的相邻省份，再记住行政中心。";
}

function getCapitalLabel() {
  return activeDatasetKey === "world" ? "首都/中心" : "行政中心";
}

function selectStudySibling(direction) {
  const pool = getRegionsInZone(studyZone);
  if (pool.length === 0) return;
  const currentIndex = Math.max(0, pool.findIndex((region) => region.id === activeId));
  const nextIndex = (currentIndex + direction + pool.length) % pool.length;
  selectStudyRegion(pool[nextIndex].id, { fitBounds: false });
}

function renderRecent() {
  if (recent.length === 0) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "暂无记录";
    recentListEl.replaceChildren(item);
    return;
  }

  const items = recent.map((id) => {
    const region = regionById.get(id);
    const item = document.createElement("li");
    item.innerHTML = `<span>${region.name}</span><small>${region.zone}</small>`;
    return item;
  });
  recentListEl.replaceChildren(...items);
}
